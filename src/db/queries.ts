import db from './database';
import { Agent, Test, TestResult, Job, JobFilters, JobStatus, TestSuite, TestSuiteTest, SuiteRun, SuiteRunFilters } from '../types';


/**
 * Create a new agent
 */
export const createAgent = (agent: Agent) => {
	// Ensure all required fields have default values
	const agentWithDefaults = {
		...agent,
		name: agent.name || '',
		version: agent.version || '',
		prompt: agent.prompt || '',
		settings: agent.settings || '{}'
	};

	const statement = db.prepare(`
	INSERT INTO agents (name, version, prompt, settings)
	VALUES (@name, @version, @prompt, @settings)
	RETURNING *
  `);
	return statement.get(agentWithDefaults) as Agent;
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

	const statement = db.prepare(`
	UPDATE agents 
	SET ${updates}
	WHERE id = @id
	RETURNING *
  `);

	return statement.get({ ...filteredAgent, id }) as Agent;
};

export const deleteAgent = (id: number) => {
	const statement = db.prepare('DELETE FROM agents WHERE id = ?');
	return statement.run(id);
};

// Test queries
export const createTest = (test: Test) => {
	// Ensure description has a default value if not provided
	const testWithDefaults = {
		...test,
		description: test.description || '',  // Default to empty string if not provided
		expected_output: test.expected_output || ''  // Default to empty string if not provided
	};

	const statement = db.prepare(`
	INSERT INTO tests (name, description, input, expected_output)
	VALUES (@name, @description, @input, @expected_output)
	RETURNING *
  `);
	return statement.get(testWithDefaults) as Test;
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

	const statement = db.prepare(`
	UPDATE tests 
	SET ${updates}, updated_at = CURRENT_TIMESTAMP
	WHERE id = @id
	RETURNING *
  `);

	return statement.get({ ...filteredTest, id }) as Test;
};

export const deleteTest = (id: number) => {
	// Start a transaction to ensure all operations succeed or fail together
	const transaction = db.transaction(() => {
		// Delete associated jobs first (due to foreign key to results)
		const deleteJobsStmt = db.prepare('DELETE FROM jobs WHERE test_id = ?');
		deleteJobsStmt.run(id);

		// Delete associated results
		const deleteResultsStmt = db.prepare('DELETE FROM results WHERE test_id = ?');
		deleteResultsStmt.run(id);

		// Finally delete the test
		const deleteTestStmt = db.prepare('DELETE FROM tests WHERE id = ?');
		return deleteTestStmt.run(id);
	});

	return transaction();
};

export const getTests = () => {
	return db.prepare('SELECT * FROM tests ORDER BY created_at DESC').all() as Test[];
};

export const getTestById = (id: number) => {
	return db.prepare('SELECT * FROM tests WHERE id = ?').get(id) as Test;
};

// Result queries
export const createResult = (result: TestResult) => {
	// Validate required fields
	if (typeof result.agent_id !== 'number' || result.agent_id <= 0) {
		throw new Error('Invalid agent_id: must be a positive number');
	}
	if (typeof result.test_id !== 'number' || result.test_id <= 0) {
		throw new Error('Invalid test_id: must be a positive number');
	}
	if (typeof result.output !== 'string') {
		// Try to serialize output if it's not a string
		try {
			result.output = JSON.stringify(result.output);
		} catch (e) {
			throw new Error('Invalid output: must be a string or JSON-serializable');
		}
	}
	if (typeof result.success !== 'boolean') {
		throw new Error('Invalid success: must be a boolean');
	}

	// Validate and ensure proper types for optional fields
	let serializedIntermediateSteps = '';
	if (result.intermediate_steps !== undefined) {
		if (typeof result.intermediate_steps === 'string') {
			serializedIntermediateSteps = result.intermediate_steps;
		} else {
			// If it's an array or object, try to serialize it
			try {
				serializedIntermediateSteps = JSON.stringify(result.intermediate_steps);
			} catch (e) {
				throw new Error('Invalid intermediate_steps: must be a string or JSON-serializable');
			}
		}
	}

	let executionTime = 0;
	if (result.execution_time !== undefined) {
		if (typeof result.execution_time !== 'number' || result.execution_time < 0) {
			throw new Error('Invalid execution_time: must be a non-negative number');
		}
		executionTime = result.execution_time;
	}

	// Create a clean object with only the fields we want to insert
	const cleanResult = {
		agent_id: result.agent_id,
		test_id: result.test_id,
		output: result.output,
		intermediate_steps: serializedIntermediateSteps,
		success: result.success ? 1 : 0, // SQLite expects 1/0 for booleans
		execution_time: executionTime
	};

	const statement = db.prepare(`
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

	try {
		const dbResult = statement.get(cleanResult) as {
			id: number;
			agent_id: number;
			test_id: number;
			output: string;
			intermediate_steps: string;
			success: number;
			execution_time: number;
			created_at: string;
		};
		// Convert the boolean back from SQLite's number representation
		return {
			id: dbResult.id,
			agent_id: dbResult.agent_id,
			test_id: dbResult.test_id,
			output: dbResult.output,
			intermediate_steps: dbResult.intermediate_steps,
			success: Boolean(dbResult.success),
			execution_time: dbResult.execution_time,
			created_at: dbResult.created_at
		};
	} catch (error) {
		console.error('Failed to insert result:', error);
		console.error('Attempted to insert:', cleanResult);
		throw new Error(`Failed to insert result: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
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

/**
 * Get execution time from a result by ID
 */
export const getExecutionTimeByResultId = (resultId: number): number | undefined => {
	const result = db.prepare('SELECT execution_time FROM results WHERE id = ?').get(resultId) as { execution_time?: number };
	return result?.execution_time;
};

// Job Queries

/**
 * Create a new job
 */
export async function createJob(job: Job): Promise<Job> {
	const statement = db.prepare(`
	INSERT INTO jobs (
	  id, agent_id, test_id, status, progress, partial_result, result_id, error, suite_run_id
	) VALUES (
	  @id, @agent_id, @test_id, @status, @progress, @partial_result, @result_id, @error, @suite_run_id
	)
  `);

	statement.run({
		id: job.id,
		agent_id: job.agent_id,
		test_id: job.test_id,
		status: job.status,
		progress: job.progress || 0,
		partial_result: job.partial_result || null,
		result_id: job.result_id || null,
		error: job.error || null,
		suite_run_id: job.suite_run_id || null
	});

	const result = await getJobById(job.id);
	if (!result) {
		throw new Error(`Failed to create job ${job.id}`);
	}
	return result;
}

/**
 * Get a job by ID
 */
export async function getJobById(id: string): Promise<Job | undefined> {
	const statement = db.prepare('SELECT * FROM jobs WHERE id = ?');
	const row = statement.get(id);
	return row as Job | undefined;
}

/**
 * Update a job
 */
export async function updateJob(id: string, updates: Partial<Job>): Promise<void> {
	// Create SET clause
	const fields = Object.keys(updates)
		.filter(key => key !== 'id' && key !== 'created_at')
		.map(key => `${key} = @${key}`);

	if (fields.length === 0) {
		return;
	}

	// Add updated_at
	fields.push('updated_at = CURRENT_TIMESTAMP');

	const statement = db.prepare(`
	UPDATE jobs
	SET ${fields.join(', ')}
	WHERE id = @id
  `);

	statement.run({
		id,
		...updates
	});
}

/**
 * List jobs with optional filtering
 */
export async function listJobs(filters: JobFilters = {}): Promise<Job[]> {
	let sql = 'SELECT * FROM jobs';
	const params: any = {};
	const conditions: string[] = [];

	if (filters.status) {
		conditions.push('status = @status');
		params.status = filters.status;
	}

	if (filters.agent_id) {
		conditions.push('agent_id = @agent_id');
		params.agent_id = filters.agent_id;
	}

	if (filters.test_id) {
		conditions.push('test_id = @test_id');
		params.test_id = filters.test_id;
	}

	if (filters.after) {
		conditions.push('created_at >= @after');
		params.after = filters.after.toISOString();
	}

	if (filters.before) {
		conditions.push('created_at <= @before');
		params.before = filters.before.toISOString();
	}

	if (filters.suite_run_id) {
		conditions.push('suite_run_id = @suite_run_id');
		params.suite_run_id = filters.suite_run_id;
	}

	if (conditions.length > 0) {
		sql += ' WHERE ' + conditions.join(' AND ');
	}

	sql += ' ORDER BY created_at DESC';

	const statement = db.prepare(sql);
	const rows = statement.all(params);
	return rows as Job[];
}

/**
 * Delete old jobs
 */
export async function deleteOldJobs(olderThan: Date): Promise<number> {
	const statement = db.prepare(`
	DELETE FROM jobs
	WHERE created_at < ?
	AND (status = 'completed' OR status = 'failed')
  `);

	const result = statement.run(olderThan.toISOString());
	return result.changes;
}

/**
 * Delete a job by ID
 */
export async function deleteJob(id: string): Promise<boolean> {
	const statement = db.prepare(`
	DELETE FROM jobs
	WHERE id = ?
  `);

	const result = statement.run(id);
	return result.changes > 0;
}

// TestSuite queries
export const createTestSuite = (testSuite: TestSuite) => {
	// Ensure fields have default values if not provided
	const testSuiteWithDefaults = {
		...testSuite,
		description: testSuite.description || '',
		tags: testSuite.tags || ''
	};

	const statement = db.prepare(`
	INSERT INTO test_suites (name, description, tags)
	VALUES (@name, @description, @tags)
	RETURNING *
  `);
	return statement.get(testSuiteWithDefaults) as TestSuite;
};

export const updateTestSuite = (id: number, testSuite: Partial<TestSuite>) => {
	// Filter out undefined values to avoid SQL errors
	const filteredTestSuite = Object.fromEntries(
		Object.entries(testSuite).filter(([_, value]) => value !== undefined)
	);

	// If there are no fields to update, return the existing test suite
	if (Object.keys(filteredTestSuite).length === 0) {
		return getTestSuiteById(id);
	}

	const updates = Object.keys(filteredTestSuite)
		.filter(key => key !== 'id' && key !== 'created_at')
		.map(key => `${key} = @${key}`)
		.join(', ');

	const statement = db.prepare(`
	UPDATE test_suites 
	SET ${updates}, updated_at = CURRENT_TIMESTAMP
	WHERE id = @id
	RETURNING *
  `);

	return statement.get({ ...filteredTestSuite, id }) as TestSuite;
};

export const deleteTestSuite = (id: number) => {
	// Start a transaction to ensure all operations succeed or fail together
	const transaction = db.transaction(() => {
		// Delete associated suite runs
		const deleteSuiteRunsStmt = db.prepare('DELETE FROM suite_runs WHERE suite_id = ?');
		deleteSuiteRunsStmt.run(id);

		// TestSuiteTests will be deleted automatically due to ON DELETE CASCADE

		// Finally delete the test suite
		const deleteTestSuiteStmt = db.prepare('DELETE FROM test_suites WHERE id = ?');
		return deleteTestSuiteStmt.run(id);
	});

	return transaction();
};

export const getTestSuites = () => {
	// Return all test suites with a test_count field
	const query = `
	SELECT s.*, COUNT(tst.test_id) as test_count
	FROM test_suites s
	LEFT JOIN test_suite_tests tst ON s.id = tst.suite_id
	GROUP BY s.id
	ORDER BY s.created_at DESC
	`;
	return db.prepare(query).all() as (TestSuite & { test_count: number })[];
};

export const getTestSuiteById = (id: number) => {
	return db.prepare('SELECT * FROM test_suites WHERE id = ?').get(id) as TestSuite;
};

// TestSuiteTest queries
export const addTestToSuite = (suiteId: number, testId: number, sequence?: number) => {
	const testSuiteTest: TestSuiteTest = {
		suite_id: suiteId,
		test_id: testId,
		sequence
	};

	const statement = db.prepare(`
	INSERT INTO test_suite_tests (suite_id, test_id, sequence)
	VALUES (@suite_id, @test_id, @sequence)
	RETURNING *
  `);

	return statement.get(testSuiteTest) as TestSuiteTest;
};

export const removeTestFromSuite = (suiteId: number, testId: number) => {
	const statement = db.prepare('DELETE FROM test_suite_tests WHERE suite_id = ? AND test_id = ?');
	return statement.run(suiteId, testId);
};

export const getTestsInSuite = (suiteId: number): Test[] => {
	const query = `
	SELECT t.*, tst.sequence
	FROM tests t
	JOIN test_suite_tests tst ON t.id = tst.test_id
	WHERE tst.suite_id = ?
	ORDER BY tst.sequence, t.name
  `;

	return db.prepare(query).all(suiteId) as (Test & { sequence?: number })[];
};

export const reorderTestsInSuite = (suiteId: number, testOrders: { test_id: number, sequence: number }[]) => {
	const transaction = db.transaction(() => {
		const statement = db.prepare('UPDATE test_suite_tests SET sequence = ? WHERE suite_id = ? AND test_id = ?');

		for (const order of testOrders) {
			statement.run(order.sequence, suiteId, order.test_id);
		}
	});

	return transaction();
};

// SuiteRun queries
export const createSuiteRun = (suiteRun: SuiteRun) => {
	const statement = db.prepare(`
	INSERT INTO suite_runs (
	  suite_id, agent_id, status, progress, 
	  total_tests, completed_tests, successful_tests, failed_tests
	)
	VALUES (
	  @suite_id, @agent_id, @status, @progress,
	  @total_tests, @completed_tests, @successful_tests, @failed_tests
	)
	RETURNING *
  `);

	return statement.get(suiteRun) as SuiteRun;
};

export const updateSuiteRun = (id: number, updates: Partial<SuiteRun>) => {
	// Filter out undefined values
	const filteredUpdates = Object.fromEntries(
		Object.entries(updates).filter(([_, value]) => value !== undefined)
	);

	// If there are no fields to update, return the existing suite run
	if (Object.keys(filteredUpdates).length === 0) {
		return getSuiteRunById(id);
	}

	const updateFields = Object.keys(filteredUpdates)
		.filter(key => key !== 'id' && key !== 'started_at')
		.map(key => `${key} = @${key}`)
		.join(', ');

	let completedField = '';
	if (updates.status === JobStatus.COMPLETED || updates.status === JobStatus.FAILED) {
		completedField = ', completed_at = CURRENT_TIMESTAMP';
	}

	const statement = db.prepare(`
	UPDATE suite_runs
	SET ${updateFields}${completedField}
	WHERE id = @id
	RETURNING *
  `);

	return statement.get({ ...filteredUpdates, id }) as SuiteRun;
};

export const getSuiteRunById = (id: number): SuiteRun | undefined => {
	return db.prepare('SELECT * FROM suite_runs WHERE id = ?').get(id) as SuiteRun;
};

export const listSuiteRuns = (filters: SuiteRunFilters = {}) => {
	let query = 'SELECT * FROM suite_runs WHERE 1=1';
	const params: any[] = [];

	if (filters.status) {
		query += ' AND status = ?';
		params.push(filters.status);
	}

	if (filters.suite_id) {
		query += ' AND suite_id = ?';
		params.push(filters.suite_id);
	}

	if (filters.agent_id) {
		query += ' AND agent_id = ?';
		params.push(filters.agent_id);
	}

	if (filters.after) {
		query += ' AND started_at >= ?';
		params.push(filters.after.toISOString());
	}

	if (filters.before) {
		query += ' AND started_at <= ?';
		params.push(filters.before.toISOString());
	}

	query += ' ORDER BY started_at DESC';

	return db.prepare(query).all(...params) as SuiteRun[];
};

export const getJobsBySuiteRunId = (suiteRunId: number) => {
	return db.prepare('SELECT * FROM jobs WHERE suite_run_id = ?').all(suiteRunId) as Job[];
};
