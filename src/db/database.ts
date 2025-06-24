import Database from 'better-sqlite3';
import path from 'path';

// Database setup
const dbPath = path.join(__dirname, '../../data/agent-testing.db');
const db = new Database(dbPath);

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

// Migration: add total_execution_time column to suite_runs table if missing
const suiteRunsInfo = db.prepare("PRAGMA table_info('suite_runs')").all() as Array<{ name: string }>;
if (!suiteRunsInfo.some(col => col.name === 'total_execution_time')) {
  db.exec("ALTER TABLE suite_runs ADD COLUMN total_execution_time REAL DEFAULT 0");
}

// Migration: add token usage columns to suite_runs table if missing
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

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_agents_name_version ON agents(name, version);
  CREATE INDEX IF NOT EXISTS idx_tests_name ON tests(name);
  CREATE INDEX IF NOT EXISTS idx_results_agent_test ON results(agent_id, test_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_agent_test ON jobs(agent_id, test_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_suite_run ON jobs(suite_run_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
  CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, job_type);
  CREATE INDEX IF NOT EXISTS idx_test_suite_tests_suite ON test_suite_tests(suite_id);
  CREATE INDEX IF NOT EXISTS idx_test_suite_tests_test ON test_suite_tests(test_id);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_suite ON suite_runs(suite_id);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_agent ON suite_runs(agent_id);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_status ON suite_runs(status);
  CREATE INDEX IF NOT EXISTS idx_llm_configs_priority ON llm_configs(priority);
  CREATE INDEX IF NOT EXISTS idx_llm_configs_provider ON llm_configs(provider);
  CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
  CREATE INDEX IF NOT EXISTS idx_suite_runs_status_suite ON suite_runs(status, suite_id);
`);

export default db;
