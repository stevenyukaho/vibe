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
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (test_id) REFERENCES tests(id),
    FOREIGN KEY (result_id) REFERENCES results(id)
  );
`);

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_agents_name_version ON agents(name, version);
  CREATE INDEX IF NOT EXISTS idx_tests_name ON tests(name);
  CREATE INDEX IF NOT EXISTS idx_results_agent_test ON results(agent_id, test_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_agent_test ON jobs(agent_id, test_id);
`);

export default db;
