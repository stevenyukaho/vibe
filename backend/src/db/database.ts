import Database from 'better-sqlite3';
import path from 'path';
import { dbConfig } from '../config';
import { serializeCapabilities } from '../lib/communicationCapabilities';

// Database setup
// Read database path from configuration (env: DB_PATH). If the configured path
// is relative, resolve it against the process working directory so that
// development (ts-node-dev) and production (node dist) behave consistently.
// Special case: :memory: is a SQLite in-memory database identifier and should not be resolved as a file path.
const configuredDbPath = dbConfig.path;
const resolvedDbPath = configuredDbPath.startsWith(':memory:')
	? configuredDbPath
	: path.isAbsolute(configuredDbPath)
		? configuredDbPath
		: path.resolve(process.cwd(), configuredDbPath);
const db: Database.Database = new Database(resolvedDbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    prompt TEXT NOT NULL,
    settings TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version)
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    input TEXT NOT NULL,
    expected_output TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    test_id INTEGER NOT NULL,
    output TEXT NOT NULL,
    intermediate_steps TEXT,
    success BOOLEAN NOT NULL,
    execution_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (test_id) REFERENCES tests(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    test_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    partial_result TEXT,
    result_id INTEGER,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    suite_run_id INTEGER,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (test_id) REFERENCES tests(id),
    FOREIGN KEY (result_id) REFERENCES results(id),
    FOREIGN KEY (suite_run_id) REFERENCES suite_runs(id)
  );

  CREATE TABLE IF NOT EXISTS test_suites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS test_suite_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id INTEGER NOT NULL,
    test_id INTEGER NOT NULL,
    sequence INTEGER,
    FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    UNIQUE(suite_id, test_id)
  );

  CREATE TABLE IF NOT EXISTS suite_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    total_tests INTEGER NOT NULL,
    completed_tests INTEGER DEFAULT 0,
    successful_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    average_execution_time REAL,
    total_execution_time REAL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (suite_id) REFERENCES test_suites(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS llm_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    config TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: add suite_run_id column to jobs table if missing
const pragmaStmt = db.prepare("PRAGMA table_info('jobs')");
const columns = pragmaStmt.all() as Array<{ name: string }>;
if (!columns.some(col => col.name === 'suite_run_id')) {
	db.exec("ALTER TABLE jobs ADD COLUMN suite_run_id INTEGER");
}

// Migration: add token usage columns to suite_runs table if missing
const suiteRunsInfo = db.prepare("PRAGMA table_info('suite_runs')").all() as Array<{ name: string }>;
if (!suiteRunsInfo.some(col => col.name === 'total_input_tokens')) {
	db.exec("ALTER TABLE suite_runs ADD COLUMN total_input_tokens INTEGER DEFAULT 0");
}
if (!suiteRunsInfo.some(col => col.name === 'total_output_tokens')) {
	db.exec("ALTER TABLE suite_runs ADD COLUMN total_output_tokens INTEGER DEFAULT 0");
}

// Migration: add job polling columns to jobs table if missing
const jobsInfo = db.prepare("PRAGMA table_info('jobs')").all() as Array<{ name: string }>;
if (!jobsInfo.some(col => col.name === 'job_type')) {
	db.exec("ALTER TABLE jobs ADD COLUMN job_type TEXT DEFAULT 'crewai'");
}
if (!jobsInfo.some(col => col.name === 'claimed_by')) {
	db.exec("ALTER TABLE jobs ADD COLUMN claimed_by TEXT");
}
if (!jobsInfo.some(col => col.name === 'claimed_at')) {
	db.exec("ALTER TABLE jobs ADD COLUMN claimed_at DATETIME");
}

// Migration: create suite_entries table if missing and migrate existing entries
const suiteEntriesInfo = db.prepare("PRAGMA table_info('suite_entries')").all() as Array<{ name: string }>;
if (!suiteEntriesInfo.some(col => col.name === 'id')) {
	db.exec(`
    CREATE TABLE IF NOT EXISTS suite_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_suite_id INTEGER NOT NULL,
      sequence INTEGER,
      test_id INTEGER,
      child_suite_id INTEGER,
      agent_id_override INTEGER,
      FOREIGN KEY (parent_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
      FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
      FOREIGN KEY (child_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
    );
  `);
	db.exec(`
    INSERT INTO suite_entries (parent_suite_id, sequence, test_id)
    SELECT suite_id, sequence, test_id FROM test_suite_tests;
  `);

	// Drop test_suite_tests table after migration (it's replaced by suite_entries)
	db.exec(`DROP TABLE IF EXISTS test_suite_tests;`);
	db.exec(`
    CREATE INDEX IF NOT EXISTS idx_suite_entries_parent ON suite_entries(parent_suite_id);
    CREATE INDEX IF NOT EXISTS idx_suite_entries_sequence ON suite_entries(sequence);
    CREATE INDEX IF NOT EXISTS idx_suite_entries_test ON suite_entries(test_id);
    CREATE INDEX IF NOT EXISTS idx_suite_entries_child ON suite_entries(child_suite_id);
  `);
}

// Migration: conversation turn targets (finalized schema pre-deploy)
try {
    const hasTurnTargetsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_turn_targets'").get() as { name?: string } | undefined;
    if (!hasTurnTargetsTable) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS conversation_turn_targets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                user_sequence INTEGER NOT NULL,
                target_reply TEXT NOT NULL,
                threshold INTEGER,
                weight REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (conversation_id, user_sequence),
                FOREIGN KEY (conversation_id, user_sequence)
                    REFERENCES conversation_messages(conversation_id, sequence)
                    ON DELETE CASCADE
            );
        `);
    }
} catch (e) {
    console.error('Ensure conversation_turn_targets table failed', e);
}

// Backfill: move generic expected outcomes into first-turn targets
try {
	// From conversations.expected_outcome -> conversation_turn_targets (sequence=1) if missing
	const hasConversations = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'").get() as { name?: string } | undefined;
	const hasTurnTargets = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_turn_targets'").get() as { name?: string } | undefined;
	// Ensure the legacy column exists before attempting the backfill
	const convCols = hasConversations
		? (db.prepare("PRAGMA table_info('conversations')").all() as Array<{ name: string }>)
		: [];
	const hasExpectedOutcomeCol = convCols.some(col => col.name === 'expected_outcome');
	if (hasConversations && hasTurnTargets && hasExpectedOutcomeCol) {
		// Insert targets for conversations that have expected_outcome and no existing target for user turn 1
		db.exec(`
			INSERT INTO conversation_turn_targets (conversation_id, user_sequence, target_reply)
			SELECT c.id, 1, c.expected_outcome
			FROM conversations c
			LEFT JOIN conversation_turn_targets t
				ON t.conversation_id = c.id AND t.user_sequence = 1
			WHERE c.expected_outcome IS NOT NULL
				AND TRIM(c.expected_outcome) <> ''
				AND t.id IS NULL;
		`);
	}
} catch (e) {
	console.error('Backfill from conversations.expected_outcome failed', e);
}

try {
	// From legacy tests.expected_output -> turn targets (sequence=1) if missing
	const hasTests = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tests'").get() as { name?: string } | undefined;
	const hasConversations = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'").get() as { name?: string } | undefined;
	const hasTurnTargets = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_turn_targets'").get() as { name?: string } | undefined;
	if (hasTests && hasConversations && hasTurnTargets) {
		db.exec(`
			INSERT INTO conversation_turn_targets (conversation_id, user_sequence, target_reply)
			SELECT c.id, 1, t.expected_output
			FROM tests t
			JOIN conversations c
				ON c.name = t.name AND c.created_at = t.created_at
			LEFT JOIN conversation_turn_targets tt
				ON tt.conversation_id = c.id AND tt.user_sequence = 1
			WHERE t.expected_output IS NOT NULL
				AND TRIM(t.expected_output) <> ''
				AND tt.id IS NULL;
		`);
	}
} catch (e) {
	console.error('Backfill from tests.expected_output failed', e);
}

// Migration: add similarity scoring columns to results table if missing
const resultsInfo = db.prepare("PRAGMA table_info('results')").all() as Array<{ name: string }>;
if (!resultsInfo.some(col => col.name === 'similarity_score')) {
	db.exec("ALTER TABLE results ADD COLUMN similarity_score INTEGER");
}
if (!resultsInfo.some(col => col.name === 'similarity_scoring_status')) {
	db.exec("ALTER TABLE results ADD COLUMN similarity_scoring_status TEXT");
}
if (!resultsInfo.some(col => col.name === 'similarity_scoring_error')) {
	db.exec("ALTER TABLE results ADD COLUMN similarity_scoring_error TEXT");
}
if (!resultsInfo.some(col => col.name === 'similarity_scoring_metadata')) {
	db.exec("ALTER TABLE results ADD COLUMN similarity_scoring_metadata TEXT");
}

// Migration: add token usage columns to results table if missing
if (!resultsInfo.some(col => col.name === 'input_tokens')) {
	db.exec("ALTER TABLE results ADD COLUMN input_tokens INTEGER");
}
if (!resultsInfo.some(col => col.name === 'output_tokens')) {
	db.exec("ALTER TABLE results ADD COLUMN output_tokens INTEGER");
}
if (!resultsInfo.some(col => col.name === 'token_mapping_metadata')) {
	db.exec("ALTER TABLE results ADD COLUMN token_mapping_metadata TEXT");
}

// Migration: Create new conversation tables
const conversationTablesInfo = db.prepare("PRAGMA table_info('conversations')").all() as Array<{ name: string }>;
if (!conversationTablesInfo.some(col => col.name === 'id')) {
	db.exec(`
    CREATE TABLE conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT, -- JSON array for flexible categorization
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'system')),
      content TEXT NOT NULL,
      metadata TEXT, -- JSON for message-specific config
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      UNIQUE(conversation_id, sequence)
    );

    CREATE TABLE execution_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      success BOOLEAN,
      error_message TEXT,
      metadata TEXT, -- JSON for session-level metrics (similarity scores, token usage, etc)
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT, -- JSON for timing, tokens, confidence, etc.
      FOREIGN KEY (session_id) REFERENCES execution_sessions(id) ON DELETE CASCADE
    );
  `);

	// 1. Migrate tests -> conversations (without test_suite_id)
	db.exec(`
    INSERT INTO conversations (name, description, tags, created_at, updated_at)
    SELECT name, description, '[]', created_at, updated_at FROM tests;
  `);

	// 1b. For each migrated test, insert a single user message so conversations are single-turn
	// Only insert when the conversation has no messages yet
	db.exec(`
    INSERT INTO conversation_messages (conversation_id, sequence, role, content, created_at)
    SELECT c.id, 1, 'user', t.input, COALESCE(t.created_at, CURRENT_TIMESTAMP)
    FROM tests t
    JOIN conversations c
      ON c.name = t.name AND c.created_at = t.created_at
    WHERE NOT EXISTS (
      SELECT 1 FROM conversation_messages m WHERE m.conversation_id = c.id
    );
  `);

	// 2. Migrate test inputs -> conversation_messages
	db.exec(`
		INSERT INTO conversation_messages (conversation_id, sequence, role, content, created_at)
		SELECT c.id, 1, 'user', t.input, t.created_at
		FROM conversations c
		JOIN tests t ON c.name = t.name AND c.created_at = t.created_at
		WHERE NOT EXISTS (
			SELECT 1 FROM conversation_messages m WHERE m.conversation_id = c.id AND m.sequence = 1
		);
	`);

	// 3. Migrate results -> execution_sessions
	db.exec(`
    INSERT INTO execution_sessions (
      conversation_id, agent_id, status, started_at, completed_at,
      success, metadata
    )
    SELECT
      c.id,
      r.agent_id,
      'completed',
      r.created_at,
      CASE
        WHEN r.execution_time IS NOT NULL AND r.execution_time > 0 THEN
          datetime(r.created_at, '+' ||
            CASE
              WHEN r.execution_time > 1000 THEN r.execution_time / 1000.0
              ELSE r.execution_time
            END || ' seconds')
        ELSE r.created_at
      END,
      r.success,
      JSON_OBJECT(
        'similarity_score', r.similarity_score,
        'similarity_scoring_status', r.similarity_scoring_status,
        'similarity_scoring_error', r.similarity_scoring_error,
        'similarity_scoring_metadata', r.similarity_scoring_metadata,
        'input_tokens', r.input_tokens,
        'output_tokens', r.output_tokens,
        'token_mapping_metadata', r.token_mapping_metadata,
        'intermediate_steps', r.intermediate_steps
      )
    FROM results r
    JOIN tests t ON r.test_id = t.id
    JOIN conversations c ON c.name = t.name AND c.created_at = t.created_at;
  `);

	// 4. Migrate result outputs -> session_messages (user input + agent output)
	db.exec(`
    INSERT INTO session_messages (session_id, sequence, role, content, timestamp, metadata)
    SELECT
      es.id,
      1,
      'user',
      cm.content,
      es.started_at,
      '{}'
    FROM execution_sessions es
    JOIN conversations c ON es.conversation_id = c.id
    JOIN conversation_messages cm ON cm.conversation_id = c.id AND cm.sequence = 1

    UNION ALL

    SELECT
      es.id,
      2,
      'assistant',
      r.output,
      es.completed_at,
      JSON_OBJECT(
        'execution_time_ms', r.execution_time,
        'input_tokens', r.input_tokens,
        'output_tokens', r.output_tokens
      )
    FROM execution_sessions es
    JOIN conversations c ON es.conversation_id = c.id
    JOIN tests t ON c.name = t.name AND c.created_at = t.created_at
    JOIN results r ON r.test_id = t.id AND r.agent_id = es.agent_id AND r.created_at = es.started_at;
  `);

	// 5. Add conversation_id and session_id columns to jobs table
	db.exec(`
    ALTER TABLE jobs ADD COLUMN conversation_id INTEGER REFERENCES conversations(id);
    ALTER TABLE jobs ADD COLUMN session_id INTEGER REFERENCES execution_sessions(id);
  `);

	// 6. Update jobs to reference conversations and sessions instead of tests and results
	db.exec(`
    UPDATE jobs SET conversation_id = (
      SELECT c.id FROM conversations c
      JOIN tests t ON c.name = t.name AND c.created_at = t.created_at
      WHERE jobs.test_id = t.id
    );

    UPDATE jobs SET session_id = (
      SELECT es.id FROM execution_sessions es
      WHERE es.conversation_id = jobs.conversation_id
      AND es.agent_id = jobs.agent_id
      AND jobs.result_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM results r
        WHERE r.id = jobs.result_id
        AND r.agent_id = es.agent_id
      )
    );
  `);

	// 7. Add conversation_id column to suite_entries if not exists
	const suiteEntriesColumns = db.prepare("PRAGMA table_info('suite_entries')").all() as Array<{ name: string }>;
	if (!suiteEntriesColumns.some(col => col.name === 'conversation_id')) {
		db.exec(`ALTER TABLE suite_entries ADD COLUMN conversation_id INTEGER REFERENCES conversations(id);`);
	}

	// 8. Update suite structure
	db.exec(`
    -- Update test_suites description to mark migration
    UPDATE test_suites SET description = COALESCE(description, '') || ' [Migrated to conversation testing]';

    -- Update suite_entries to reference conversations
    UPDATE suite_entries SET conversation_id = (
      SELECT c.id FROM conversations c
      JOIN tests t ON c.name = t.name AND c.created_at = t.created_at
      WHERE suite_entries.test_id = t.id
    ) WHERE test_id IS NOT NULL;
  `);
}

// Post-migration guards for partially migrated databases
// Ensure conversation-era tables exist even if conversations already existed from a prior partial migration
try {
	// 1) Ensure conversation_messages exists
	const convMsgInfo = db.prepare("PRAGMA table_info('conversation_messages')").all() as Array<{ name: string }>;
	if (!convMsgInfo.some(col => col.name === 'id')) {
		db.exec(`
			CREATE TABLE IF NOT EXISTS conversation_messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				conversation_id INTEGER NOT NULL,
				sequence INTEGER NOT NULL,
				role TEXT NOT NULL CHECK (role IN ('user', 'system')),
				content TEXT NOT NULL,
				metadata TEXT,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
				UNIQUE(conversation_id, sequence)
			);
		`);
	}

	// 2) Ensure execution_sessions exists
	const execSessInfo = db.prepare("PRAGMA table_info('execution_sessions')").all() as Array<{ name: string }>;
	if (!execSessInfo.some(col => col.name === 'id')) {
		db.exec(`
			CREATE TABLE IF NOT EXISTS execution_sessions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				conversation_id INTEGER NOT NULL,
				agent_id INTEGER NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
				started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				completed_at TIMESTAMP,
				success BOOLEAN,
				error_message TEXT,
				metadata TEXT,
				FOREIGN KEY (conversation_id) REFERENCES conversations(id),
				FOREIGN KEY (agent_id) REFERENCES agents(id)
			);
		`);
	}

	// 3) Ensure session_messages exists
	const sessMsgInfo = db.prepare("PRAGMA table_info('session_messages')").all() as Array<{ name: string }>;
	if (!sessMsgInfo.some(col => col.name === 'id')) {
		db.exec(`
			CREATE TABLE IF NOT EXISTS session_messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				session_id INTEGER NOT NULL,
				sequence INTEGER NOT NULL,
				role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
				content TEXT NOT NULL,
				timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				metadata TEXT,
				FOREIGN KEY (session_id) REFERENCES execution_sessions(id) ON DELETE CASCADE
			);
		`);
	}

	// 4) Ensure jobs has conversation_id and session_id columns
	const jobsCols = db.prepare("PRAGMA table_info('jobs')").all() as Array<{ name: string }>;
	if (!jobsCols.some(col => col.name === 'conversation_id')) {
		db.exec("ALTER TABLE jobs ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)");
	}
	if (!jobsCols.some(col => col.name === 'session_id')) {
		db.exec("ALTER TABLE jobs ADD COLUMN session_id INTEGER REFERENCES execution_sessions(id)");
	}

	// 4b) Note: jobs rebuild moved to a standalone guard executed after this try block

	// 5) Ensure suite_entries has conversation_id column
	const suiteEntryCols = db.prepare("PRAGMA table_info('suite_entries')").all() as Array<{ name: string }>;
	if (suiteEntryCols.length > 0 && !suiteEntryCols.some(col => col.name === 'conversation_id')) {
		db.exec("ALTER TABLE suite_entries ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)");
	}

	// 6) Idempotent backfills where legacy tables still exist
	const testsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'tests'").get() as { name?: string } | undefined;
	const resultsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'results'").get() as { name?: string } | undefined;

	if (suiteEntryCols.length > 0 && testsTable) {
		db.exec(`
      UPDATE suite_entries SET conversation_id = (
        SELECT c.id FROM conversations c
        JOIN tests t ON c.name = t.name AND c.created_at = t.created_at
        WHERE suite_entries.test_id = t.id
      )
      WHERE test_id IS NOT NULL AND conversation_id IS NULL;
    `);

		// After mapping, null out legacy pointer to avoid mixed references
		db.exec(`
      UPDATE suite_entries
      SET test_id = NULL
      WHERE conversation_id IS NOT NULL;
    `);
	}

	if (jobsCols.length > 0 && testsTable) {
		db.exec(`
      UPDATE jobs SET conversation_id = (
        SELECT c.id FROM conversations c
        JOIN tests t ON c.name = t.name AND c.created_at = t.created_at
        WHERE jobs.test_id = t.id
      )
      WHERE conversation_id IS NULL AND test_id IS NOT NULL;
    `);
	}

	if (jobsCols.length > 0 && resultsTable) {
		db.exec(`
			UPDATE jobs SET session_id = (
				SELECT es.id FROM execution_sessions es
				WHERE es.conversation_id = jobs.conversation_id
				AND es.agent_id = jobs.agent_id
				AND jobs.result_id IS NOT NULL
				AND EXISTS (
					SELECT 1 FROM results r
					WHERE r.id = jobs.result_id AND r.agent_id = es.agent_id
				)
			)
			WHERE session_id IS NULL;
		`);
	}
} catch (e) {
	console.error('Post-migration guard failed', e);
}

// Migration: Add per-turn scoring columns to session_messages (after ensuring base table exists)
try {
	const sessMsgCols = db.prepare("PRAGMA table_info('session_messages')").all() as Array<{ name: string }>;
	if (!sessMsgCols.some(col => col.name === 'similarity_score')) {
		db.exec("ALTER TABLE session_messages ADD COLUMN similarity_score REAL");
	}
	if (!sessMsgCols.some(col => col.name === 'similarity_scoring_status')) {
		db.exec("ALTER TABLE session_messages ADD COLUMN similarity_scoring_status TEXT");
	}
	if (!sessMsgCols.some(col => col.name === 'similarity_scoring_error')) {
		db.exec("ALTER TABLE session_messages ADD COLUMN similarity_scoring_error TEXT");
	}
	if (!sessMsgCols.some(col => col.name === 'similarity_scoring_metadata')) {
		db.exec("ALTER TABLE session_messages ADD COLUMN similarity_scoring_metadata TEXT");
	}
} catch (e) {
	console.error('Add scoring columns to session_messages failed', e);
}

// Migration: backfill per-turn similarity fields onto assistant session_messages
// from execution_sessions.metadata where present (only fills missing values)
try {
	const sessionsWithMeta = db.prepare(`
		SELECT id, metadata
		FROM execution_sessions
		WHERE metadata IS NOT NULL AND metadata != ''
	`).all() as Array<{ id: number; metadata: string | null }>;

	const selectAssistantMsg = db.prepare(`
        SELECT id FROM session_messages
        WHERE session_id = ? AND role = 'assistant'
        ORDER BY sequence ASC
        LIMIT 1
    `);

	const updateAssistantMsg = db.prepare(`
		UPDATE session_messages
		SET
			similarity_score = COALESCE(?, similarity_score),
			similarity_scoring_status = COALESCE(?, similarity_scoring_status),
			similarity_scoring_error = COALESCE(?, similarity_scoring_error),
			similarity_scoring_metadata = COALESCE(?, similarity_scoring_metadata)
		WHERE id = ?
			AND (similarity_score IS NULL
				AND similarity_scoring_status IS NULL
				AND similarity_scoring_error IS NULL
				AND similarity_scoring_metadata IS NULL)
	`);

	const backfillTx = db.transaction(() => {
		for (const row of sessionsWithMeta) {
			if (!row.metadata) continue;
			let meta: any = {};
			try {
				meta = JSON.parse(row.metadata);
			} catch { }
			const score = typeof meta?.similarity_score === 'number' ? meta.similarity_score : null;
			const status = typeof meta?.similarity_scoring_status === 'string' ? meta.similarity_scoring_status : null;
			const error = typeof meta?.similarity_scoring_error === 'string' ? meta.similarity_scoring_error : null;
			let metaStr: string | null = null;
			if (meta && meta.similarity_scoring_metadata !== undefined) {
				if (typeof meta.similarity_scoring_metadata === 'string') {
					metaStr = meta.similarity_scoring_metadata;
				} else {
					try { metaStr = JSON.stringify(meta.similarity_scoring_metadata); } catch { metaStr = null; }
				}
			}

			if (score !== null || status !== null || error !== null || metaStr !== null) {
				const assistant = selectAssistantMsg.get(row.id) as { id?: number } | undefined;
				if (assistant?.id) {
					updateAssistantMsg.run(score, status, error, metaStr, assistant.id);
				}
			}
		}
	});
	backfillTx();
} catch (e) {
	console.error('Backfill similarity from session metadata to session_messages failed', e);
}

// ensure jobs.test_id is nullable even if earlier guarded migration didn't run
try {
	const jobsColsDetailedFinal = db.prepare("PRAGMA table_info('jobs')").all() as Array<{ name: string; notnull: number }>;
	const testIdColFinal = jobsColsDetailedFinal.find(c => c.name === 'test_id');
	if (testIdColFinal && Number(testIdColFinal.notnull) === 1) {
		db.transaction(() => {
			db.exec(`
        CREATE TABLE jobs_new (
          id TEXT PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          test_id INTEGER,
			  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
          progress INTEGER DEFAULT 0,
          partial_result TEXT,
          result_id INTEGER,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          suite_run_id INTEGER,
          job_type TEXT DEFAULT 'crewai',
          claimed_by TEXT,
          claimed_at DATETIME,
          conversation_id INTEGER,
          session_id INTEGER,
          FOREIGN KEY (agent_id) REFERENCES agents(id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id),
          FOREIGN KEY (session_id) REFERENCES execution_sessions(id),
          FOREIGN KEY (suite_run_id) REFERENCES suite_runs(id)
        );
      `);

			// Copy data using explicit column list while validating FK targets
			db.exec(`
			INSERT INTO jobs_new (
			  id, agent_id, test_id, status, progress, partial_result, result_id,
			  error, created_at, updated_at, suite_run_id, job_type, claimed_by, claimed_at,
			  conversation_id, session_id
			)
			SELECT
			  j.id, j.agent_id, j.test_id, j.status, j.progress, j.partial_result, j.result_id,
			  j.error, j.created_at, j.updated_at,
			  CASE WHEN j.suite_run_id IS NOT NULL AND EXISTS (SELECT 1 FROM suite_runs s WHERE s.id = j.suite_run_id) THEN j.suite_run_id ELSE NULL END AS suite_run_id,
			  j.job_type, j.claimed_by, j.claimed_at,
			  CASE WHEN j.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = j.conversation_id) THEN j.conversation_id ELSE NULL END AS conversation_id,
			  CASE WHEN j.session_id IS NOT NULL AND EXISTS (SELECT 1 FROM execution_sessions es WHERE es.id = j.session_id) THEN j.session_id ELSE NULL END AS session_id
			FROM jobs j;
			`);

			// Swap tables
			db.exec(`DROP TABLE jobs;`);
			db.exec(`ALTER TABLE jobs_new RENAME TO jobs;`);
		})();
	}
} catch (e) {
	console.error('Jobs test_id nullable guard failed', e);
}

// Migration: ensure suite_entries.conversation_id has ON DELETE CASCADE
try {
	const suiteEntriesForeignKeys = db.prepare("PRAGMA foreign_key_list('suite_entries')").all() as Array<{
		id: number; seq: number; table: string; from: string; to: string; on_update?: string; on_delete?: string;
	}>;
	const conversationForeignKey = suiteEntriesForeignKeys.find(fk => fk.table === 'conversations' && fk.from === 'conversation_id');
	const hasCascade = conversationForeignKey && String(conversationForeignKey.on_delete || '').toUpperCase() === 'CASCADE';

	if (!hasCascade) {
		db.transaction(() => {
			db.exec(`
        CREATE TABLE suite_entries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_suite_id INTEGER NOT NULL,
          sequence INTEGER,
          test_id INTEGER,
          conversation_id INTEGER,
          child_suite_id INTEGER,
          agent_id_override INTEGER,
          FOREIGN KEY (parent_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (child_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
        );

        INSERT INTO suite_entries_new (id, parent_suite_id, sequence, test_id, conversation_id, child_suite_id, agent_id_override)
        SELECT id, parent_suite_id, sequence, test_id, conversation_id, child_suite_id, agent_id_override FROM suite_entries;

        DROP TABLE suite_entries;
        ALTER TABLE suite_entries_new RENAME TO suite_entries;
      `);

			db.exec(`
        CREATE INDEX IF NOT EXISTS idx_suite_entries_parent ON suite_entries(parent_suite_id);
        CREATE INDEX IF NOT EXISTS idx_suite_entries_sequence ON suite_entries(sequence);
        CREATE INDEX IF NOT EXISTS idx_suite_entries_test ON suite_entries(test_id);
        CREATE INDEX IF NOT EXISTS idx_suite_entries_child ON suite_entries(child_suite_id);
        CREATE INDEX IF NOT EXISTS idx_suite_entries_conversation ON suite_entries(conversation_id);
      `);
		})();
	}
} catch (e) {
	// Best-effort migration; ignore if PRAGMA not available
	console.error('Ensure suite_entries cascade migration failed', e);
}

function dropLegacyTablesIfSafe() {
	try {
		// Check if legacy tables still exist
		const legacyTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('tests', 'results')
    `).all() as { name: string }[];

		if (legacyTables.length === 0) {
			return;
		}

		// Check that no jobs depend exclusively on legacy fields
		const legacyJobsResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM jobs
      WHERE test_id IS NOT NULL AND conversation_id IS NULL
    `).get() as { count: number };

		if (legacyJobsResult.count > 0) {
			return;
		}

		// Check and fix suite entries that depend exclusively on legacy fields
		const legacySuiteEntriesResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM suite_entries
      WHERE test_id IS NOT NULL AND conversation_id IS NULL
    `).get() as { count: number };

		if (legacySuiteEntriesResult.count > 0) {
			// Since the original tests table is gone, we need to map test_id to conversation_id
			// The safest approach is to assume test_id == conversation_id for the migration
			// and remove entries where no corresponding conversation exists

			// First, update suite entries where a conversation with matching ID exists
			db.exec(`
        UPDATE suite_entries
        SET conversation_id = test_id, test_id = NULL
        WHERE test_id IS NOT NULL
        AND conversation_id IS NULL
        AND EXISTS (SELECT 1 FROM conversations WHERE id = suite_entries.test_id)
      `);

			db.exec(`
        DELETE FROM suite_entries
        WHERE test_id IS NOT NULL
        AND conversation_id IS NULL
      `);

			// Double-check that all suite entries are now migrated
			const remainingLegacyEntries = db.prepare(`
        SELECT COUNT(*) as count
        FROM suite_entries
        WHERE test_id IS NOT NULL AND conversation_id IS NULL
      `).get() as { count: number };

			if (remainingLegacyEntries.count > 0) {
				return;
			}
		}

		// Create backup first
		db.exec(`
      ATTACH DATABASE 'data/agent-testing.db.before-drop-legacy' AS backup;
      CREATE TABLE IF NOT EXISTS backup.tests AS SELECT * FROM tests;
      CREATE TABLE IF NOT EXISTS backup.results AS SELECT * FROM results;
      DETACH DATABASE backup;
    `);

		// Recreate affected tables without legacy foreign key constraints
		// Get current record counts for validation
		const preCounts = {
			jobs: (db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }).count,
			suite_entries: (db.prepare('SELECT COUNT(*) as count FROM suite_entries').get() as { count: number }).count
		};

		db.transaction(() => {
			// Recreate jobs table without FK constraints to legacy tables
			db.exec(`
        CREATE TABLE jobs_new (
          id TEXT PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          test_id INTEGER,
          status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          progress INTEGER DEFAULT 0,
          partial_result TEXT,
          result_id INTEGER,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          suite_run_id INTEGER,
          job_type TEXT DEFAULT 'crewai',
          claimed_by TEXT,
          claimed_at DATETIME,
          conversation_id INTEGER,
          session_id INTEGER,
          FOREIGN KEY (agent_id) REFERENCES agents(id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id),
          FOREIGN KEY (session_id) REFERENCES execution_sessions(id),
          FOREIGN KEY (suite_run_id) REFERENCES suite_runs(id)
        );

        INSERT INTO jobs_new SELECT * FROM jobs;
        DROP TABLE jobs;
        ALTER TABLE jobs_new RENAME TO jobs;
      `);

			// Recreate suite_entries table without FK constraint to tests
			db.exec(`
        CREATE TABLE suite_entries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_suite_id INTEGER NOT NULL,
          sequence INTEGER,
          test_id INTEGER,
          conversation_id INTEGER,
          child_suite_id INTEGER,
          agent_id_override INTEGER,
          FOREIGN KEY (parent_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (child_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
        );

        INSERT INTO suite_entries_new SELECT * FROM suite_entries;
        DROP TABLE suite_entries;
        ALTER TABLE suite_entries_new RENAME TO suite_entries;
      `);

			// Now drop the legacy tables
			db.exec(`
        DROP TABLE results;
        DROP TABLE tests;
      `);
		})();

		// Validate the migration
		const postCounts = {
			jobs: (db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }).count,
			suite_entries: (db.prepare('SELECT COUNT(*) as count FROM suite_entries').get() as { count: number }).count
		};

		if (postCounts.jobs !== preCounts.jobs || postCounts.suite_entries !== preCounts.suite_entries) {
			throw new Error('Record counts changed during migration');
		}
	} catch (error) {
		console.error('Drop legacy tables migration failed', error);
	}
}

// After backfill, rebuild conversations to drop expected_outcome column if it still exists
try {
	const convInfo = db.prepare("PRAGMA table_info('conversations')").all() as Array<{ name: string }>;
	const hasExpectedOutcome = convInfo.some(col => col.name === 'expected_outcome');
	if (hasExpectedOutcome) {
		// Temporarily disable FK enforcement to allow table rebuild while preserving ids
		const fkWasOn = db.pragma('foreign_keys', { simple: true }) as number;
		if (fkWasOn) {
			db.exec('PRAGMA foreign_keys = OFF');
		}
		try {
			db.transaction(() => {
				db.exec(`
					CREATE TABLE conversations_new (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						name TEXT NOT NULL,
						description TEXT,
						tags TEXT,
						created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
						updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
					);

					INSERT INTO conversations_new (id, name, description, tags, created_at, updated_at)
					SELECT id, name, description, COALESCE(tags, '[]'), created_at, updated_at FROM conversations;

					DROP TABLE conversations;
					ALTER TABLE conversations_new RENAME TO conversations;
				`);
			})();
		} finally {
			if (fkWasOn) {
				db.exec('PRAGMA foreign_keys = ON');
				// Validate referential integrity after rebuild
				try {
					db.exec('PRAGMA foreign_key_check');
				} catch (e) {
					console.error('Foreign key check failed', e);
				}
			}
		}
	}
} catch (e) {
	console.error('Conversations table rebuild failed', e);
}

// Migration: agent request templates, response maps, and selection/variables columns
try {
	// 1) Ensure agent_request_templates table
	db.exec(`
		CREATE TABLE IF NOT EXISTS agent_request_templates (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			agent_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			engine TEXT DEFAULT 'handlebars',
			content_type TEXT DEFAULT 'application/json',
			body TEXT NOT NULL,
			tags TEXT,
			is_default INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
			UNIQUE(agent_id, name)
		);
	`);
	// Unique default per agent (partial unique index)
	try {
		db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_req_tmpl_default ON agent_request_templates(agent_id) WHERE is_default = 1;`);
	} catch { } // older SQLite might not support partial indexes; enforce in code if needed
	const reqTemplateCols = db.prepare("PRAGMA table_info('agent_request_templates')").all() as Array<{ name: string }>;
	if (reqTemplateCols.length > 0 && !reqTemplateCols.some(col => col.name === 'capabilities')) {
		db.exec("ALTER TABLE agent_request_templates ADD COLUMN capabilities TEXT DEFAULT '{}'");
		db.exec("UPDATE agent_request_templates SET capabilities = '{}' WHERE capabilities IS NULL");
	}

	// 2) Ensure agent_response_maps table
	db.exec(`
		CREATE TABLE IF NOT EXISTS agent_response_maps (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			agent_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			spec TEXT NOT NULL,
			tags TEXT,
			is_default INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
			UNIQUE(agent_id, name)
		);
	`);
	try {
		db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_resp_map_default ON agent_response_maps(agent_id) WHERE is_default = 1;`);
	} catch { /* see note above */ }
	const respMapCols = db.prepare("PRAGMA table_info('agent_response_maps')").all() as Array<{ name: string }>;
	if (respMapCols.length > 0 && !respMapCols.some(col => col.name === 'capabilities')) {
		db.exec("ALTER TABLE agent_response_maps ADD COLUMN capabilities TEXT DEFAULT '{}'");
		db.exec("UPDATE agent_response_maps SET capabilities = '{}' WHERE capabilities IS NULL");
	}

	// 3) Add selection/variables columns to conversations
	const convCols2 = db.prepare("PRAGMA table_info('conversations')").all() as Array<{ name: string }>;
	if (!convCols2.some(c => c.name === 'default_request_template_id')) {
		db.exec("ALTER TABLE conversations ADD COLUMN default_request_template_id INTEGER");
	}
	if (!convCols2.some(c => c.name === 'default_response_map_id')) {
		db.exec("ALTER TABLE conversations ADD COLUMN default_response_map_id INTEGER");
	}
	if (!convCols2.some(c => c.name === 'variables')) {
		db.exec("ALTER TABLE conversations ADD COLUMN variables TEXT");
	}
	if (!convCols2.some(c => c.name === 'required_request_template_capabilities')) {
		db.exec("ALTER TABLE conversations ADD COLUMN required_request_template_capabilities TEXT");
	}
	if (!convCols2.some(c => c.name === 'required_response_map_capabilities')) {
		db.exec("ALTER TABLE conversations ADD COLUMN required_response_map_capabilities TEXT");
	}
	if (!convCols2.some(c => c.name === 'stop_on_failure')) {
		db.exec("ALTER TABLE conversations ADD COLUMN stop_on_failure INTEGER DEFAULT 0");
	}

	// 4) Add overrides/variables to conversation_messages
	const convMsgCols2 = db.prepare("PRAGMA table_info('conversation_messages')").all() as Array<{ name: string }>;
	if (convMsgCols2.length > 0 && !convMsgCols2.some(c => c.name === 'request_template_id')) {
		db.exec("ALTER TABLE conversation_messages ADD COLUMN request_template_id INTEGER");
	}
	if (convMsgCols2.length > 0 && !convMsgCols2.some(c => c.name === 'response_map_id')) {
		db.exec("ALTER TABLE conversation_messages ADD COLUMN response_map_id INTEGER");
	}
	if (convMsgCols2.length > 0 && !convMsgCols2.some(c => c.name === 'set_variables')) {
		db.exec("ALTER TABLE conversation_messages ADD COLUMN set_variables TEXT");
	}

	// 5) Add variables to execution_sessions
	const execSessCols2 = db.prepare("PRAGMA table_info('execution_sessions')").all() as Array<{ name: string }>;
	if (!execSessCols2.some(c => c.name === 'variables')) {
		db.exec("ALTER TABLE execution_sessions ADD COLUMN variables TEXT");
	}

	// 6) Backfill from agents.settings (one-shot): move request_template/response_mapping into new tables, set defaults, and clean settings
	const agents = db.prepare("SELECT id, settings FROM agents").all() as Array<{ id: number; settings: string }>;
	const insertReqTmpl = db.prepare(`
		INSERT INTO agent_request_templates (agent_id, name, description, engine, content_type, body, tags, is_default)
		VALUES (@agent_id, @name, @description, @engine, @content_type, @body, @tags, @is_default)
	`);
	const insertRespMap = db.prepare(`
		INSERT INTO agent_response_maps (agent_id, name, description, spec, tags, is_default)
		VALUES (@agent_id, @name, @description, @spec, @tags, @is_default)
	`);
	const selectAnyReqDefault = db.prepare("SELECT id FROM agent_request_templates WHERE agent_id = ? AND is_default = 1 LIMIT 1");
	const selectAnyRespDefault = db.prepare("SELECT id FROM agent_response_maps WHERE agent_id = ? AND is_default = 1 LIMIT 1");
	const updateAgentSettings = db.prepare("UPDATE agents SET settings = @settings WHERE id = @id");

	const backfillTx = db.transaction(() => {
		for (const ag of agents) {
			if (!ag?.settings) continue;
			let settingsObj: any = {};
			try {
				settingsObj = JSON.parse(ag.settings);
			} catch { settingsObj = {}; }
			const isExternal = String(settingsObj?.type || '').toLowerCase() === 'external_api';

			if (!isExternal) {
				continue;
			}

			let changed = false;

			// request_template -> agent_request_templates (default)
			if (settingsObj.request_template && !selectAnyReqDefault.get(ag.id)) {
				const body = typeof settingsObj.request_template === 'string'
					? settingsObj.request_template
					: (() => { try { return JSON.stringify(settingsObj.request_template); } catch { return String(settingsObj.request_template); } })();
				insertReqTmpl.run({
					agent_id: ag.id,
					name: 'default',
					description: null,
					engine: 'handlebars',
					content_type: 'application/json',
					body,
					tags: null,
					is_default: 1
				});
				delete settingsObj.request_template;
				changed = true;
			}

			// response_mapping -> agent_response_maps (default)
			if (settingsObj.response_mapping && !selectAnyRespDefault.get(ag.id)) {
				const spec = typeof settingsObj.response_mapping === 'string'
					? settingsObj.response_mapping
					: (() => { try { return JSON.stringify(settingsObj.response_mapping); } catch { return String(settingsObj.response_mapping); } })();
				insertRespMap.run({
					agent_id: ag.id,
					name: 'default',
					description: null,
					spec,
					tags: null,
					is_default: 1
				});
				delete settingsObj.response_mapping;
				changed = true;
			}

			// If changed, persist cleaned settings JSON
			if (changed) {
				let settingsStr = '{}';
				try {
					settingsStr = JSON.stringify(settingsObj);
				} catch { settingsStr = '{}'; }
				updateAgentSettings.run({ id: ag.id, settings: settingsStr });
			}
		}
	});
	backfillTx();
} catch (e) {
	console.error('Templates/maps migration failed', e);
}

// Migration: Global template library (request_templates, response_maps, junction tables)
try {
	// 1) Create global request_templates table
	db.exec(`
		CREATE TABLE IF NOT EXISTS request_templates (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			capability TEXT,
			body TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
	`);

	// 2) Create global response_maps table
	db.exec(`
		CREATE TABLE IF NOT EXISTS response_maps (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			capability TEXT,
			spec TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
	`);

	// 3) Create agent-to-template junction table (many-to-many)
	db.exec(`
		CREATE TABLE IF NOT EXISTS agent_template_links (
			agent_id INTEGER NOT NULL,
			template_id INTEGER NOT NULL,
			is_default INTEGER DEFAULT 0,
			linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (agent_id, template_id),
			FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
			FOREIGN KEY (template_id) REFERENCES request_templates(id) ON DELETE CASCADE
		);
	`);

	// 4) Create agent-to-response-map junction table (many-to-many)
	db.exec(`
		CREATE TABLE IF NOT EXISTS agent_response_map_links (
			agent_id INTEGER NOT NULL,
			response_map_id INTEGER NOT NULL,
			is_default INTEGER DEFAULT 0,
			linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (agent_id, response_map_id),
			FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
			FOREIGN KEY (response_map_id) REFERENCES response_maps(id) ON DELETE CASCADE
		);
	`);

	// 5) Create legacy template mappings table (idempotent backfills)
	db.exec(`
		CREATE TABLE IF NOT EXISTS legacy_template_mappings (
			kind TEXT NOT NULL,
			legacy_id INTEGER NOT NULL,
			global_id INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (kind, legacy_id)
		);
	`);

	// Ensure linked_at columns exist on older tables
	const templateLinkCols = db.prepare("PRAGMA table_info('agent_template_links')").all() as Array<{ name: string }>;
	if (!templateLinkCols.some(col => col.name === 'linked_at')) {
		db.exec("ALTER TABLE agent_template_links ADD COLUMN linked_at TIMESTAMP");
		db.exec("UPDATE agent_template_links SET linked_at = CURRENT_TIMESTAMP WHERE linked_at IS NULL");
	}

	const mapLinkCols = db.prepare("PRAGMA table_info('agent_response_map_links')").all() as Array<{ name: string }>;
	if (!mapLinkCols.some(col => col.name === 'linked_at')) {
		db.exec("ALTER TABLE agent_response_map_links ADD COLUMN linked_at TIMESTAMP");
		db.exec("UPDATE agent_response_map_links SET linked_at = CURRENT_TIMESTAMP WHERE linked_at IS NULL");
	}

	// Ensure only one default per agent before unique indexes
	const cleanupDefaultsTx = db.transaction(() => {
		const dupTemplateDefaults = db.prepare(`
			SELECT agent_id FROM agent_template_links
			WHERE is_default = 1
			GROUP BY agent_id
			HAVING COUNT(*) > 1
		`).all() as Array<{ agent_id: number }>;

		for (const { agent_id } of dupTemplateDefaults) {
			const keep = db.prepare(`
				SELECT template_id FROM agent_template_links
				WHERE agent_id = ? AND is_default = 1
				ORDER BY linked_at DESC, template_id DESC
				LIMIT 1
			`).get(agent_id) as { template_id?: number } | undefined;

			if (keep?.template_id) {
				db.prepare(`
					UPDATE agent_template_links
					SET is_default = CASE WHEN template_id = ? THEN 1 ELSE 0 END
					WHERE agent_id = ?
				`).run(keep.template_id, agent_id);
			}
		}

		const dupMapDefaults = db.prepare(`
			SELECT agent_id FROM agent_response_map_links
			WHERE is_default = 1
			GROUP BY agent_id
			HAVING COUNT(*) > 1
		`).all() as Array<{ agent_id: number }>;

		for (const { agent_id } of dupMapDefaults) {
			const keep = db.prepare(`
				SELECT response_map_id FROM agent_response_map_links
				WHERE agent_id = ? AND is_default = 1
				ORDER BY linked_at DESC, response_map_id DESC
				LIMIT 1
			`).get(agent_id) as { response_map_id?: number } | undefined;

			if (keep?.response_map_id) {
				db.prepare(`
					UPDATE agent_response_map_links
					SET is_default = CASE WHEN response_map_id = ? THEN 1 ELSE 0 END
					WHERE agent_id = ?
				`).run(keep.response_map_id, agent_id);
			}
		}
	});

	cleanupDefaultsTx();

	// Create indexes for the new tables
	db.exec(`
		CREATE INDEX IF NOT EXISTS idx_request_templates_capability ON request_templates(capability);
		CREATE INDEX IF NOT EXISTS idx_request_templates_name ON request_templates(name);
		CREATE INDEX IF NOT EXISTS idx_response_maps_capability ON response_maps(capability);
		CREATE INDEX IF NOT EXISTS idx_response_maps_name ON response_maps(name);
		CREATE INDEX IF NOT EXISTS idx_agent_template_links_agent ON agent_template_links(agent_id);
		CREATE INDEX IF NOT EXISTS idx_agent_template_links_template ON agent_template_links(template_id);
		CREATE INDEX IF NOT EXISTS idx_agent_response_map_links_agent ON agent_response_map_links(agent_id);
		CREATE INDEX IF NOT EXISTS idx_agent_response_map_links_map ON agent_response_map_links(response_map_id);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_template_links_default ON agent_template_links(agent_id) WHERE is_default = 1;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_response_map_links_default ON agent_response_map_links(agent_id) WHERE is_default = 1;
		CREATE INDEX IF NOT EXISTS idx_legacy_template_mappings_global ON legacy_template_mappings(global_id);
	`);
} catch (e) {
	console.error('Global template library migration failed', e);
}

// Migration: Copy existing agent-scoped templates to global tables (idempotent)
try {
	const legacyTemplateCount = (db.prepare('SELECT COUNT(*) as count FROM agent_request_templates').get() as { count: number }).count;
	const legacyMapCount = (db.prepare('SELECT COUNT(*) as count FROM agent_response_maps').get() as { count: number }).count;

	if (legacyTemplateCount > 0 || legacyMapCount > 0) {
		console.log('Migrating agent-scoped templates to global template library...');

		const normalizeCapability = (value: string | null) => serializeCapabilities(value);

		const existingTemplates = db.prepare(`
			SELECT id, name, description, capability, body
			FROM request_templates
		`).all() as Array<{ id: number; name: string; capability: string | null; body: string }>;

		const existingMaps = db.prepare(`
			SELECT id, name, description, capability, spec
			FROM response_maps
		`).all() as Array<{ id: number; name: string; capability: string | null; spec: string }>;

		// Get all legacy request templates
		const legacyTemplates = db.prepare(`
			SELECT art.*, a.name as agent_name
			FROM agent_request_templates art
			JOIN agents a ON art.agent_id = a.id
			ORDER BY art.agent_id, art.is_default DESC
		`).all() as Array<{
			id: number;
			agent_id: number;
			name: string;
			description: string | null;
			body: string;
			capabilities: string | null;
			is_default: number;
			agent_name: string;
			created_at: string | null;
		}>;

		// Get all legacy response maps
		const legacyMaps = db.prepare(`
			SELECT arm.*, a.name as agent_name
			FROM agent_response_maps arm
			JOIN agents a ON arm.agent_id = a.id
			ORDER BY arm.agent_id, arm.is_default DESC
		`).all() as Array<{
			id: number;
			agent_id: number;
			name: string;
			description: string | null;
			spec: string;
			capabilities: string | null;
			is_default: number;
			agent_name: string;
			created_at: string | null;
		}>;

		// Track used names to avoid conflicts (seed from existing globals)
		const usedTemplateNames = new Set(existingTemplates.map(t => t.name));
		const usedMapNames = new Set(existingMaps.map(m => m.name));

		// Dedupe by name + body/spec (+ capability)
		const templateKeyToGlobalId = new Map<string, number>();
		const mapKeyToGlobalId = new Map<string, number>();

		for (const t of existingTemplates) {
			const key = `${t.name}::${t.body}::${normalizeCapability(t.capability) ?? ''}`;
			templateKeyToGlobalId.set(key, t.id);
		}
		for (const m of existingMaps) {
			const key = `${m.name}::${m.spec}::${normalizeCapability(m.capability) ?? ''}`;
			mapKeyToGlobalId.set(key, m.id);
		}

		// Prepared statements for insertion and linking
		const insertGlobalTemplate = db.prepare(`
			INSERT INTO request_templates (name, description, capability, body)
			VALUES (@name, @description, @capability, @body)
		`);
		const linkTemplate = db.prepare(`
			INSERT OR IGNORE INTO agent_template_links (agent_id, template_id, is_default, linked_at)
			VALUES (@agent_id, @template_id, @is_default, @linked_at)
		`);
		const insertGlobalMap = db.prepare(`
			INSERT INTO response_maps (name, description, capability, spec)
			VALUES (@name, @description, @capability, @spec)
		`);
		const linkMap = db.prepare(`
			INSERT OR IGNORE INTO agent_response_map_links (agent_id, response_map_id, is_default, linked_at)
			VALUES (@agent_id, @response_map_id, @is_default, @linked_at)
		`);
		const insertLegacyMapping = db.prepare(`
			INSERT OR IGNORE INTO legacy_template_mappings (kind, legacy_id, global_id)
			VALUES (@kind, @legacy_id, @global_id)
		`);

		// Helper to generate unique name
		const getUniqueName = (baseName: string, agentName: string, usedNames: Set<string>): string => {
			let name = baseName;
			if (usedNames.has(name)) {
				name = `${baseName} (${agentName})`;
				let counter = 2;
				while (usedNames.has(name)) {
					name = `${baseName} (${agentName} ${counter})`;
					counter++;
				}
			}
			usedNames.add(name);
			return name;
		};

		// Migrate request templates
		const migrateTemplatesTx = db.transaction(() => {
			let inserted = 0;
			let reused = 0;
			for (const lt of legacyTemplates) {
				const normalizedCapability = normalizeCapability(lt.capabilities);
				const key = `${lt.name}::${lt.body}::${normalizedCapability ?? ''}`;
				let globalId = templateKeyToGlobalId.get(key);

				if (!globalId) {
					const uniqueName = getUniqueName(lt.name, lt.agent_name, usedTemplateNames);
					const result = insertGlobalTemplate.run({
						name: uniqueName,
						description: lt.description,
						capability: normalizedCapability,
						body: lt.body
					});
					globalId = Number(result.lastInsertRowid);
					templateKeyToGlobalId.set(key, globalId);
					inserted += 1;
				} else {
					reused += 1;
				}

				linkTemplate.run({
					agent_id: lt.agent_id,
					template_id: globalId,
					is_default: lt.is_default,
					linked_at: lt.created_at ?? null
				});

				insertLegacyMapping.run({
					kind: 'request_template',
					legacy_id: lt.id,
					global_id: globalId
				});
			}

			return { inserted, reused };
		});
		const templateResult = migrateTemplatesTx();

		// Migrate response maps
		const migrateMapsTx = db.transaction(() => {
			let inserted = 0;
			let reused = 0;
			for (const lm of legacyMaps) {
				const normalizedCapability = normalizeCapability(lm.capabilities);
				const key = `${lm.name}::${lm.spec}::${normalizedCapability ?? ''}`;
				let globalId = mapKeyToGlobalId.get(key);

				if (!globalId) {
					const uniqueName = getUniqueName(lm.name, lm.agent_name, usedMapNames);
					const result = insertGlobalMap.run({
						name: uniqueName,
						description: lm.description,
						capability: normalizedCapability,
						spec: lm.spec
					});
					globalId = Number(result.lastInsertRowid);
					mapKeyToGlobalId.set(key, globalId);
					inserted += 1;
				} else {
					reused += 1;
				}

				linkMap.run({
					agent_id: lm.agent_id,
					response_map_id: globalId,
					is_default: lm.is_default,
					linked_at: lm.created_at ?? null
				});

				insertLegacyMapping.run({
					kind: 'response_map',
					legacy_id: lm.id,
					global_id: globalId
				});
			}

			return { inserted, reused };
		});
		const mapResult = migrateMapsTx();

		console.log(
			`Migrated ${legacyTemplates.length} legacy request templates into ${templateResult.inserted} new global templates ` +
			`(${templateResult.reused} reused), and ${legacyMaps.length} legacy response maps into ${mapResult.inserted} new global maps ` +
			`(${mapResult.reused} reused).`
		);
	}
} catch (e) {
	console.error('Template data migration failed', e);
}

// Migration: Backfill conversation template/map IDs to global IDs (idempotent)
try {
	db.exec(`
		UPDATE conversations
		SET default_request_template_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversations.default_request_template_id
		)
		WHERE default_request_template_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversations.default_request_template_id
		);
	`);

	db.exec(`
		UPDATE conversations
		SET default_response_map_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversations.default_response_map_id
		)
		WHERE default_response_map_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversations.default_response_map_id
		);
	`);

	db.exec(`
		UPDATE conversation_messages
		SET request_template_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversation_messages.request_template_id
		)
		WHERE request_template_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversation_messages.request_template_id
		);
	`);

	db.exec(`
		UPDATE conversation_messages
		SET response_map_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversation_messages.response_map_id
		)
		WHERE response_map_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversation_messages.response_map_id
		);
	`);
} catch (e) {
	console.error('Conversation template-id backfill failed', e);
}

// Create indexes for better performance (only for tables that will remain)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_agents_name_version ON agents(name, version);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_suite_run ON jobs(suite_run_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
  CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, job_type);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_suite ON suite_runs(suite_id);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_agent ON suite_runs(agent_id);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_status ON suite_runs(status);
  CREATE INDEX IF NOT EXISTS idx_llm_configs_priority ON llm_configs(priority);
  CREATE INDEX IF NOT EXISTS idx_llm_configs_provider ON llm_configs(provider);
  CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_status_suite ON suite_runs(status, suite_id);

  -- New conversation indexes
  CREATE INDEX IF NOT EXISTS idx_conversations_name ON conversations(name);
  CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
  CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_conversation_messages_sequence ON conversation_messages(conversation_id, sequence);
  CREATE INDEX IF NOT EXISTS idx_execution_sessions_conversation ON execution_sessions(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_execution_sessions_agent ON execution_sessions(agent_id);
  CREATE INDEX IF NOT EXISTS idx_execution_sessions_status ON execution_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_session_messages_sequence ON session_messages(session_id, sequence);
  CREATE INDEX IF NOT EXISTS idx_jobs_conversation ON jobs(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_session ON jobs(session_id);
`);

// Minimal guard: ensure suite_entries.conversation_id exists, then create its index
try {
	const suiteEntriesColsForIndex = db.prepare("PRAGMA table_info('suite_entries')").all() as Array<{ name: string }>;
	if (suiteEntriesColsForIndex.length > 0 && !suiteEntriesColsForIndex.some(col => col.name === 'conversation_id')) {
		// Try to add the column if it's missing (idempotent)
		db.exec("ALTER TABLE suite_entries ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)");
	}
	const suiteEntriesColsAfter = db.prepare("PRAGMA table_info('suite_entries')").all() as Array<{ name: string }>;
	if (suiteEntriesColsAfter.some(col => col.name === 'conversation_id')) {
		db.exec("CREATE INDEX IF NOT EXISTS idx_suite_entries_conversation ON suite_entries(conversation_id)");
	}
} catch (e) {
	console.error('Minimal guard for suite_entries index failed', e);
}

// Check if we can safely drop legacy tables on every startup
dropLegacyTablesIfSafe();

export default db;
