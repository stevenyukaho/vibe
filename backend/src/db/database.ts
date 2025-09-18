import Database from 'better-sqlite3';
import path from 'path';
import { dbConfig } from '../config';

// Database setup
// Read database path from configuration (env: DB_PATH). If the configured path
// is relative, resolve it against the process working directory so that
// development (ts-node-dev) and production (node dist) behave consistently.
const configuredDbPath = dbConfig.path;
const resolvedDbPath = path.isAbsolute(configuredDbPath)
	? configuredDbPath
	: path.resolve(process.cwd(), configuredDbPath);
const db = new Database(resolvedDbPath);

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
      expected_outcome TEXT, -- High-level success criteria
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
    INSERT INTO conversations (name, description, expected_outcome, created_at, updated_at)
    SELECT name, description, expected_output, created_at, updated_at FROM tests;
  `);

	// 2. Migrate test inputs -> conversation_messages
	db.exec(`
    INSERT INTO conversation_messages (conversation_id, sequence, role, content, created_at)
    SELECT c.id, 1, 'user', t.input, t.created_at
    FROM conversations c
    JOIN tests t ON c.name = t.name AND c.created_at = t.created_at;
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
} catch (_e) {
	// Best-effort migration; ignore if PRAGMA not available
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
			const updatedEntries = db.prepare(`
        UPDATE suite_entries
        SET conversation_id = test_id, test_id = NULL
        WHERE test_id IS NOT NULL
        AND conversation_id IS NULL
        AND EXISTS (SELECT 1 FROM conversations WHERE id = suite_entries.test_id)
      `).run();

			// Remove orphaned suite entries that reference non-existent conversations
			const orphanedEntries = db.prepare(`
        DELETE FROM suite_entries
        WHERE test_id IS NOT NULL
        AND conversation_id IS NULL
      `).run();

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
	} catch (error) { }
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
  CREATE INDEX IF NOT EXISTS idx_suite_entries_conversation ON suite_entries(conversation_id);
`);

// Check if we can safely drop legacy tables on every startup
dropLegacyTablesIfSafe();

export default db;
