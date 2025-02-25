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
    // Ensure all required fields have default values
    const agentWithDefaults = {
        ...agent,
        name: agent.name || '',
        version: agent.version || '',
        prompt: agent.prompt || '',
        settings: agent.settings || '{}'
    };
    
    const stmt = db.prepare(`
    INSERT INTO agents (name, version, prompt, settings)
    VALUES (@name, @version, @prompt, @settings)
    RETURNING *
  `);
    return stmt.get(agentWithDefaults) as Agent;
};

export const getAgents = () => {
    return db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as Agent[];
};

export const getAgentById = (id: number) => {
    return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent;
};

export const updateAgent = (id: number, agent: Partial<Agent>) => {
    // Filter out undefined values to avoid SQL errors
    const filteredAgent = Object.fromEntries(
        Object.entries(agent).filter(([_, value]) => value !== undefined)
    );
    
    // If there are no fields to update, return the existing agent
    if (Object.keys(filteredAgent).length === 0) {
        return getAgentById(id);
    }
    
    const updates = Object.keys(filteredAgent)
        .filter(key => key !== 'id' && key !== 'created_at')
        .map(key => `${key} = @${key}`)
        .join(', ');

    const stmt = db.prepare(`
    UPDATE agents 
    SET ${updates}
    WHERE id = @id
    RETURNING *
  `);
    
    return stmt.get({ ...filteredAgent, id }) as Agent;
};

export const deleteAgent = (id: number) => {
    const stmt = db.prepare('DELETE FROM agents WHERE id = ?');
    return stmt.run(id);
};

// Test queries
export const createTest = (test: Test) => {
    // Ensure description has a default value if not provided
    const testWithDefaults = {
        ...test,
        description: test.description || '',  // Default to empty string if not provided
        expected_output: test.expected_output || ''  // Default to empty string if not provided
    };
    
    const stmt = db.prepare(`
    INSERT INTO tests (name, description, input, expected_output)
    VALUES (@name, @description, @input, @expected_output)
    RETURNING *
  `);
    return stmt.get(testWithDefaults) as Test;
};

export const updateTest = (id: number, test: Partial<Test>) => {
    // Filter out undefined values to avoid SQL errors
    const filteredTest = Object.fromEntries(
        Object.entries(test).filter(([_, value]) => value !== undefined)
    );
    
    // If there are no fields to update, return the existing test
    if (Object.keys(filteredTest).length === 0) {
        return getTestById(id);
    }
    
    const updates = Object.keys(filteredTest)
        .filter(key => key !== 'id')
        .map(key => `${key} = @${key}`)
        .join(', ');

    const stmt = db.prepare(`
    UPDATE tests 
    SET ${updates}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
    RETURNING *
  `);

    return stmt.get({ ...filteredTest, id }) as Test;
};

export const deleteTest = (id: number) => {
    const stmt = db.prepare('DELETE FROM tests WHERE id = ?');
    return stmt.run(id);
};

export const getTests = () => {
    return db.prepare('SELECT * FROM tests ORDER BY created_at DESC').all() as Test[];
};

export const getTestById = (id: number) => {
    return db.prepare('SELECT * FROM tests WHERE id = ?').get(id) as Test;
};

// Result queries
export const createResult = (result: TestResult) => {
    // Ensure all required fields have default values
    const resultWithDefaults = {
        ...result,
        agent_id: result.agent_id,
        test_id: result.test_id,
        output: result.output || '',
        intermediate_steps: result.intermediate_steps || '',
        success: typeof result.success === 'boolean' ? result.success : false,
        execution_time: result.execution_time || 0
    };
    
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
    return stmt.get(resultWithDefaults) as TestResult;
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