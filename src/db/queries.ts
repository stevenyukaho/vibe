import db from './database';

// Types
export interface Agent {
    id?: number;
    name: string;
    version: string;
    prompt: string;
    settings: string;
    created_at?: string;
}

export interface Test {
    id?: number;
    name: string;
    description?: string;
    input: string;
    expected_output?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TestResult {
    id?: number;
    agent_id: number;
    test_id: number;
    output: string;
    intermediate_steps?: string;
    success: boolean;
    execution_time?: number;
    created_at?: string;
}

// Agent queries
export const createAgent = (agent: Agent) => {
    const stmt = db.prepare(`
    INSERT INTO agents (name, version, prompt, settings)
    VALUES (@name, @version, @prompt, @settings)
    RETURNING *
  `);
    return stmt.get(agent) as Agent;
};

export const getAgents = () => {
    return db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as Agent[];
};

export const getAgentById = (id: number) => {
    return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent;
};

// Test queries
export const createTest = (test: Test) => {
    const stmt = db.prepare(`
    INSERT INTO tests (name, description, input, expected_output)
    VALUES (@name, @description, @input, @expected_output)
    RETURNING *
  `);
    return stmt.get(test) as Test;
};

export const updateTest = (id: number, test: Partial<Test>) => {
    const updates = Object.entries(test)
        .filter(([key]) => key !== 'id')
        .map(([key]) => `${key} = @${key}`)
        .join(', ');

    const stmt = db.prepare(`
    UPDATE tests 
    SET ${updates}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
    RETURNING *
  `);

    return stmt.get({ ...test, id }) as Test;
};

export const getTests = () => {
    return db.prepare('SELECT * FROM tests ORDER BY created_at DESC').all() as Test[];
};

export const getTestById = (id: number) => {
    return db.prepare('SELECT * FROM tests WHERE id = ?').get(id) as Test;
};

// Result queries
export const createResult = (result: TestResult) => {
    const stmt = db.prepare(`
    INSERT INTO results (
      agent_id, test_id, output, intermediate_steps,
      success, execution_time
    )
    VALUES (
      @agent_id, @test_id, @output, @intermediate_steps,
      @success, @execution_time
    )
    RETURNING *
  `);
    return stmt.get(result) as TestResult;
};

export const getResults = (filters?: { agent_id?: number; test_id?: number }) => {
    let query = 'SELECT * FROM results';
    const params: any[] = [];

    if (filters) {
        const conditions: string[] = [];
        if (filters.agent_id) {
            conditions.push('agent_id = ?');
            params.push(filters.agent_id);
        }
        if (filters.test_id) {
            conditions.push('test_id = ?');
            params.push(filters.test_id);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
    }

    query += ' ORDER BY created_at DESC';
    return db.prepare(query).all(...params) as TestResult[];
};

export const getResultById = (id: number) => {
    return db.prepare('SELECT * FROM results WHERE id = ?').get(id) as TestResult;
};