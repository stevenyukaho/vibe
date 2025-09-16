import db from './database';
import {
	Agent,
	Test,
	TestResult,
	Job,
	JobFilters,
	JobStatus,
	TestSuite,
	SuiteEntry,
	SuiteRun,
	SuiteRunFilters,
	LLMConfig,
	Conversation,
	ConversationMessage,
	ExecutionSession,
	SessionMessage
} from '../types';


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

	// Handle token usage fields
	let inputTokens = null;
	let outputTokens = null;
	let tokenMappingMetadata = '';

	if (
		result.input_tokens !== undefined
		&& typeof result.input_tokens === 'number'
		&& result.input_tokens >= 0
	) {
		inputTokens = Math.floor(result.input_tokens);
	}

	if (
		result.output_tokens !== undefined
		&& typeof result.output_tokens === 'number'
		&& result.output_tokens >= 0
	) {
		outputTokens = Math.floor(result.output_tokens);
	}

	if (result.token_mapping_metadata !== undefined) {
		if (typeof result.token_mapping_metadata === 'string') {
			tokenMappingMetadata = result.token_mapping_metadata;
		} else {
			try {
				tokenMappingMetadata = JSON.stringify(result.token_mapping_metadata);
			} catch (e) {
				console.warn('Invalid token_mapping_metadata: must be a string or JSON-serializable');
			}
		}
	}

	// Create a clean object with only the fields we want to insert
	const cleanResult = {
		agent_id: result.agent_id,
		test_id: result.test_id,
		output: result.output,
		intermediate_steps: serializedIntermediateSteps,
		success: result.success ? 1 : 0, // SQLite expects 1/0 for booleans
		execution_time: executionTime,
		input_tokens: inputTokens,
		output_tokens: outputTokens,
		token_mapping_metadata: tokenMappingMetadata
	};

	const statement = db.prepare(`
		INSERT INTO results (
			agent_id, test_id, output, intermediate_steps,
			success, execution_time, input_tokens, output_tokens, token_mapping_metadata
		)
		VALUES (
			@agent_id, @test_id, @output, @intermediate_steps,
			@success, @execution_time, @input_tokens, @output_tokens, @token_mapping_metadata
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
			input_tokens: number | null;
			output_tokens: number | null;
			token_mapping_metadata: string;
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
			input_tokens: dbResult.input_tokens,
			output_tokens: dbResult.output_tokens,
			token_mapping_metadata: dbResult.token_mapping_metadata,
			created_at: dbResult.created_at
		};
	} catch (error) {
		console.error('Failed to insert result:', error);
		console.error('Attempted to insert:', cleanResult);
		throw new Error(`Failed to insert result: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
};

export const getResults = (filters?: { agent_id?: number; test_id?: number; limit?: number; offset?: number }) => {
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

	if (filters?.limit !== undefined) {
		query += ' LIMIT ?';
		params.push(filters.limit);
	}
	if (filters?.offset !== undefined) {
		query += ' OFFSET ?';
		params.push(filters.offset);
	}

	return db.prepare(query).all(...params) as TestResult[];
};

export const getResultsWithCount = (filters?: { agent_id?: number; test_id?: number; limit?: number; offset?: number }): { data: TestResult[], total: number } => {
	// First, get the total count without pagination
	let countQuery = 'SELECT COUNT(*) as count FROM results';
	const countParams: any[] = [];

	if (filters) {
		const conditions: string[] = [];
		if (filters.agent_id) {
			conditions.push('agent_id = ?');
			countParams.push(filters.agent_id);
		}
		if (filters.test_id) {
			conditions.push('test_id = ?');
			countParams.push(filters.test_id);
		}
		if (conditions.length > 0) {
			countQuery += ' WHERE ' + conditions.join(' AND ');
		}
	}

	const countResult = db.prepare(countQuery).get(...countParams) as { count: number };
	const total = countResult.count;

	// Then get the actual data
	const data = getResults(filters);

	return { data, total };
};

export const getResultById = (id: number) => {
	return db.prepare('SELECT * FROM results WHERE id = ?').get(id) as TestResult;
};

export const updateResult = (id: number, updates: Partial<TestResult>) => {
	const filteredUpdates = Object.fromEntries(
		Object.entries(updates).filter(([key, value]) =>
			value !== undefined &&
			key !== 'id' &&
			key !== 'created_at'
		)
	);

	// If there are no fields to update, return
	if (Object.keys(filteredUpdates).length === 0) {
		return;
	}

	const fields = Object.keys(filteredUpdates).map(key => `${key} = @${key}`);

	const statement = db.prepare(`
		UPDATE results
		SET ${fields.join(', ')}
		WHERE id = @id
	`);

	statement.run({
		id,
		...filteredUpdates
	});
};

// Legacy helper removed: execution time is computed from execution_sessions timestamps

// Job Queries

/**
 * Create a new job
 */
export async function createJob(job: Job): Promise<Job> {
	const statement = db.prepare(`
	INSERT INTO jobs (
	  id, agent_id, test_id, conversation_id, status, progress, partial_result, result_id, session_id, error, suite_run_id, job_type, claimed_by, claimed_at
	) VALUES (
	  @id, @agent_id, @test_id, @conversation_id, @status, @progress, @partial_result, @result_id, @session_id, @error, @suite_run_id, @job_type, @claimed_by, @claimed_at
	)
  `);

	statement.run({
		id: job.id,
		agent_id: job.agent_id,
		test_id: job.test_id || null,
		conversation_id: job.conversation_id || null,
		status: job.status,
		progress: job.progress || 0,
		partial_result: job.partial_result || null,
		result_id: job.result_id || null,
		session_id: job.session_id || null,
		error: job.error || null,
		suite_run_id: job.suite_run_id || null,
		job_type: job.job_type || 'crewai',
		claimed_by: job.claimed_by || null,
		claimed_at: job.claimed_at || null
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
export async function listJobs(filters: JobFilters & { limit?: number; offset?: number } = {}): Promise<Job[]> {
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

	if (filters.job_type) {
		conditions.push('job_type = @job_type');
		params.job_type = filters.job_type;
	}

	if (conditions.length > 0) {
		sql += ' WHERE ' + conditions.join(' AND ');
	}

	sql += ' ORDER BY created_at DESC';

	if (filters.limit !== undefined) {
		sql += ' LIMIT @limit';
		params.limit = filters.limit;
	}
	if (filters.offset !== undefined) {
		sql += ' OFFSET @offset';
		params.offset = filters.offset;
	}

	const statement = db.prepare(sql);
	return statement.all(params) as Job[];
}

export async function listJobsWithCount(filters: JobFilters & { limit?: number; offset?: number } = {}): Promise<{ data: Job[], total: number }> {
	// First, get the total count without pagination
	let countSql = 'SELECT COUNT(*) as count FROM jobs';
	const countParams: any = {};
	const conditions: string[] = [];

	if (filters.status) {
		conditions.push('status = @status');
		countParams.status = filters.status;
	}

	if (filters.agent_id) {
		conditions.push('agent_id = @agent_id');
		countParams.agent_id = filters.agent_id;
	}

	if (filters.test_id) {
		conditions.push('test_id = @test_id');
		countParams.test_id = filters.test_id;
	}

	if (filters.after) {
		conditions.push('created_at >= @after');
		countParams.after = filters.after.toISOString();
	}

	if (filters.before) {
		conditions.push('created_at <= @before');
		countParams.before = filters.before.toISOString();
	}

	if (filters.suite_run_id) {
		conditions.push('suite_run_id = @suite_run_id');
		countParams.suite_run_id = filters.suite_run_id;
	}

	if (filters.job_type) {
		conditions.push('job_type = @job_type');
		countParams.job_type = filters.job_type;
	}

	if (conditions.length > 0) {
		countSql += ' WHERE ' + conditions.join(' AND ');
	}

	const countStatement = db.prepare(countSql);
	const countResult = countStatement.get(countParams) as { count: number };
	const total = countResult.count;

	// Then get the actual data
	const data = await listJobs(filters);

	return { data, total };
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
	return db.prepare('SELECT * FROM test_suites ORDER BY created_at DESC').all() as TestSuite[];
};

export const getTestSuiteById = (id: number) => {
	return db.prepare('SELECT * FROM test_suites WHERE id = ?').get(id) as TestSuite;
};


export const getEntriesInSuite = (parentSuiteId: number): SuiteEntry[] => {
	const stmt = db.prepare(`
        SELECT *
        FROM suite_entries
        WHERE parent_suite_id = ?
        ORDER BY sequence
    `);
	return stmt.all(parentSuiteId) as SuiteEntry[];
};



export const addSuiteEntry = (entry: {
	parent_suite_id: number;
	sequence?: number;
	test_id?: number;
	conversation_id?: number;
	child_suite_id?: number;
	agent_id_override?: number;
}): SuiteEntry => {
	const statement = db.prepare(`
        INSERT INTO suite_entries (
            parent_suite_id, sequence, test_id, conversation_id, child_suite_id, agent_id_override
        ) VALUES (
            @parent_suite_id, @sequence, @test_id, @conversation_id, @child_suite_id, @agent_id_override
        )
        RETURNING *
    `);
	return statement.get(entry) as SuiteEntry;
};

export const updateSuiteEntryOrder = (
	entryId: number,
	sequence?: number,
	agent_id_override?: number
): void => {
	const fields: string[] = [];
	const params: any = { id: entryId };
	if (sequence !== undefined) {
		fields.push('sequence = @sequence');
		params.sequence = sequence;
	}
	if (agent_id_override !== undefined) {
		fields.push('agent_id_override = @agent_id_override');
		params.agent_id_override = agent_id_override;
	}
	if (fields.length === 0) return;
	const stmt = db.prepare(`
        UPDATE suite_entries
        SET ${fields.join(', ')}
        WHERE id = @id
    `);
	stmt.run(params);
};

export const deleteSuiteEntry = (entryId: number): void => {
	const stmt = db.prepare('DELETE FROM suite_entries WHERE id = ?');
	stmt.run(entryId);
};

// Add functions for single entry retrieval and reordering
export const getSuiteEntryById = (entryId: number): SuiteEntry | undefined => {
	return db.prepare('SELECT * FROM suite_entries WHERE id = ?').get(entryId) as SuiteEntry;
};

export const reorderSuiteEntries = (
	parentSuiteId: number,
	entryOrders: { entry_id: number; sequence: number }[]
) => {
	const transaction = db.transaction(() => {
		const stmt = db.prepare(
			'UPDATE suite_entries SET sequence = ? WHERE parent_suite_id = ? AND id = ?'
		);
		for (const order of entryOrders) {
			stmt.run(order.sequence, parentSuiteId, order.entry_id);
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

export const listSuiteRuns = (filters: SuiteRunFilters & { limit?: number; offset?: number } = {}) => {
	let query = `
		SELECT
			sr.*,
			a.name as agent_name
		FROM suite_runs sr
		LEFT JOIN agents a ON sr.agent_id = a.id
		WHERE 1=1
	`;
	const params: any[] = [];

	if (filters.status) {
		query += ' AND sr.status = ?';
		params.push(filters.status);
	}

	if (filters.suite_id) {
		query += ' AND sr.suite_id = ?';
		params.push(filters.suite_id);
	}

	if (filters.agent_id) {
		query += ' AND sr.agent_id = ?';
		params.push(filters.agent_id);
	}

	if (filters.after) {
		query += ' AND sr.started_at >= ?';
		params.push(filters.after.toISOString());
	}

	if (filters.before) {
		query += ' AND sr.started_at <= ?';
		params.push(filters.before.toISOString());
	}

	query += ' ORDER BY sr.started_at DESC';

	if (filters.limit !== undefined) {
		query += ' LIMIT ?';
		params.push(filters.limit);
	}
	if (filters.offset !== undefined) {
		query += ' OFFSET ?';
		params.push(filters.offset);
	}

	return db.prepare(query).all(...params) as SuiteRun[];
};

export const listSuiteRunsWithCount = (filters: SuiteRunFilters & { limit?: number; offset?: number } = {}): { data: SuiteRun[], total: number } => {
	// First, get the total count without pagination
	let countQuery = 'SELECT COUNT(*) as count FROM suite_runs WHERE 1=1';
	const countParams: any[] = [];

	if (filters.status) {
		countQuery += ' AND status = ?';
		countParams.push(filters.status);
	}

	if (filters.suite_id) {
		countQuery += ' AND suite_id = ?';
		countParams.push(filters.suite_id);
	}

	if (filters.agent_id) {
		countQuery += ' AND agent_id = ?';
		countParams.push(filters.agent_id);
	}

	if (filters.after) {
		countQuery += ' AND started_at >= ?';
		countParams.push(filters.after.toISOString());
	}

	if (filters.before) {
		countQuery += ' AND started_at <= ?';
		countParams.push(filters.before.toISOString());
	}

	const countResult = db.prepare(countQuery).get(...countParams) as { count: number };
	const total = countResult.count;

	// Then get the actual data
	const data = listSuiteRuns(filters);

	return { data, total };
};

export const getJobsBySuiteRunId = (suiteRunId: number) => {
	return db.prepare('SELECT * FROM jobs WHERE suite_run_id = ?').all(suiteRunId) as Job[];
};

/**
 * Get aggregated token usage for a suite run
 */
export const getSuiteRunTokenUsage = (suiteRunId: number): { total_input_tokens: number; total_output_tokens: number } => {
	// Sum tokens from execution session metadata for completed jobs in the suite run
	const sessions = db.prepare(`
		SELECT es.metadata
		FROM execution_sessions es
		WHERE es.id IN (
			SELECT j.session_id FROM jobs j
			WHERE j.suite_run_id = ? AND j.status = 'completed' AND j.session_id IS NOT NULL
		)
	`).all(suiteRunId) as { metadata: string | null }[];

	let total_input_tokens = 0;
	let total_output_tokens = 0;

	for (const row of sessions) {
		if (!row.metadata) continue;
		try {
			const meta = JSON.parse(row.metadata);
			if (typeof meta?.input_tokens === 'number') total_input_tokens += meta.input_tokens;
			if (typeof meta?.output_tokens === 'number') total_output_tokens += meta.output_tokens;
		} catch { }
	}

	return { total_input_tokens, total_output_tokens };
};

export const deleteSuiteRun = (id: number) => {
	// Start a transaction to ensure all operations succeed or fail together
	const transaction = db.transaction(() => {
		// Delete associated jobs
		const deleteJobsStmt = db.prepare('DELETE FROM jobs WHERE suite_run_id = ?');
		deleteJobsStmt.run(id);

		// Delete the suite run
		const deleteSuiteRunStmt = db.prepare('DELETE FROM suite_runs WHERE id = ?');
		return deleteSuiteRunStmt.run(id);
	});

	return transaction();
};

// LLM Config queries
export const createLLMConfig = (llmConfig: LLMConfig) => {
	// Ensure all required fields have default values
	const configWithDefaults = {
		...llmConfig,
		name: llmConfig.name || '',
		provider: llmConfig.provider || '',
		config: llmConfig.config || '{}',
		priority: llmConfig.priority || 100
	};

	const statement = db.prepare(`
		INSERT INTO llm_configs (name, provider, config, priority)
		VALUES (@name, @provider, @config, @priority)
		RETURNING *
	`);
	return statement.get(configWithDefaults) as LLMConfig;
};

export const getLLMConfigs = () => {
	return db.prepare('SELECT * FROM llm_configs ORDER BY priority ASC').all() as LLMConfig[];
};

export const getLLMConfigById = (id: number) => {
	return db.prepare('SELECT * FROM llm_configs WHERE id = ?').get(id) as LLMConfig;
};

export const updateLLMConfig = (id: number, config: Partial<LLMConfig>) => {
	// Filter out undefined values to avoid SQL errors
	const filteredConfig = Object.fromEntries(
		Object.entries(config).filter(([_, value]) => value !== undefined)
	);

	// If there are no fields to update, return the existing config
	if (Object.keys(filteredConfig).length === 0) {
		return getLLMConfigById(id);
	}

	const updates = Object.keys(filteredConfig)
		.filter(key => key !== 'id' && key !== 'created_at')
		.map(key => `${key} = @${key}`)
		.join(', ');

	const statement = db.prepare(`
		UPDATE llm_configs
		SET ${updates}, updated_at = CURRENT_TIMESTAMP
		WHERE id = @id
		RETURNING *
	`);

	return statement.get({ ...filteredConfig, id }) as LLMConfig;
};

export const deleteLLMConfig = (id: number) => {
	const statement = db.prepare('DELETE FROM llm_configs WHERE id = ?');
	return statement.run(id);
};

export const getAgentsWithCount = (params: { limit?: number; offset?: number } = {}): { data: Agent[]; total: number } => {
	const { limit, offset } = params;
	let query = 'SELECT * FROM agents ORDER BY created_at DESC';
	const queryParams: any[] = [];

	if (limit !== undefined) {
		query += ' LIMIT ?';
		queryParams.push(limit);
	}
	if (offset !== undefined) {
		query += ' OFFSET ?';
		queryParams.push(offset);
	}

	const data = db.prepare(query).all(...queryParams) as Agent[];
	const totalResult = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };

	return { data, total: totalResult.count };
};

export const getTestsWithCount = (params: { limit?: number; offset?: number } = {}): { data: Test[]; total: number } => {
	const { limit, offset } = params;
	let query = 'SELECT * FROM tests ORDER BY created_at DESC';
	const queryParams: any[] = [];

	if (limit !== undefined) {
		query += ' LIMIT ?';
		queryParams.push(limit);
	}
	if (offset !== undefined) {
		query += ' OFFSET ?';
		queryParams.push(offset);
	}

	const data = db.prepare(query).all(...queryParams) as Test[];
	const totalResult = db.prepare('SELECT COUNT(*) as count FROM tests').get() as { count: number };

	return { data, total: totalResult.count };
};

export const getAgentsCount = (): number => {
	const row = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
	return row.count;
};

/**
 * Count legacy "tests" which are represented as single-turn conversations
 * A single-turn conversation has exactly one user message.
 */
export const getSingleTurnTestsCount = (): number => {
	const row = db.prepare(`
        SELECT COUNT(*) AS count
        FROM (
          SELECT c.id
          FROM conversations c
          JOIN conversation_messages m ON m.conversation_id = c.id
          GROUP BY c.id
          HAVING SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) = 1
        ) t
    `).get() as { count: number };
	return row.count;
};

export const getTestSuitesWithCount = (params: { limit?: number; offset?: number } = {}): { data: TestSuite[]; total: number } => {
	const { limit, offset } = params;
	let query = 'SELECT * FROM test_suites ORDER BY created_at DESC';
	const queryParams: any[] = [];

	if (limit !== undefined) {
		query += ' LIMIT ?';
		queryParams.push(limit);
	}
	if (offset !== undefined) {
		query += ' OFFSET ?';
		queryParams.push(offset);
	}

	const data = db.prepare(query).all(...queryParams) as TestSuite[];
	const totalResult = db.prepare('SELECT COUNT(*) as count FROM test_suites').get() as { count: number };

	return { data, total: totalResult.count };
};

export const getLLMConfigsWithCount = (params: { limit?: number; offset?: number } = {}): { data: LLMConfig[]; total: number } => {
	const { limit, offset } = params;
	let query = 'SELECT * FROM llm_configs ORDER BY priority ASC';
	const queryParams: any[] = [];

	if (limit !== undefined) {
		query += ' LIMIT ?';
		queryParams.push(limit);
	}
	if (offset !== undefined) {
		query += ' OFFSET ?';
		queryParams.push(offset);
	}

	const data = db.prepare(query).all(...queryParams) as LLMConfig[];
	const totalResult = db.prepare('SELECT COUNT(*) as count FROM llm_configs').get() as { count: number };

	return { data, total: totalResult.count };
};

export const createConversation = (conversation: Conversation) => {
	const conversationWithDefaults = {
		...conversation,
		name: conversation.name || '',
		description: conversation.description || '',
		tags: conversation.tags || '[]',
		expected_outcome: conversation.expected_outcome || ''
	};

	const statement = db.prepare(`
		INSERT INTO conversations (name, description, tags, expected_outcome)
		VALUES (@name, @description, @tags, @expected_outcome)
		RETURNING *
	`);
	return statement.get(conversationWithDefaults) as Conversation;
};

export const getConversations = () => {
	return db.prepare('SELECT * FROM conversations ORDER BY created_at DESC').all() as Conversation[];
};

export const getConversationById = (id: number) => {
	return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation;
};

export const getConversationsWithCount = (params: { limit?: number; offset?: number } = {}): { data: Conversation[]; total: number } => {
	const { limit, offset } = params;
	let query = 'SELECT * FROM conversations ORDER BY created_at DESC';
	const queryParams: any[] = [];

	if (limit !== undefined) {
		query += ' LIMIT ?';
		queryParams.push(limit);
	}
	if (offset !== undefined) {
		query += ' OFFSET ?';
		queryParams.push(offset);
	}

	const data = db.prepare(query).all(...queryParams) as Conversation[];
	const totalResult = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };

	return { data, total: totalResult.count };
};

export const updateConversation = (id: number, conversation: Partial<Conversation>) => {
	const filteredConversation = Object.fromEntries(
		Object.entries(conversation).filter(([_, value]) => value !== undefined)
	);

	if (Object.keys(filteredConversation).length === 0) {
		return getConversationById(id);
	}

	const updates = Object.keys(filteredConversation)
		.filter(key => key !== 'id' && key !== 'created_at')
		.map(key => `${key} = @${key}`)
		.join(', ');

	const statement = db.prepare(`
		UPDATE conversations
		SET ${updates}, updated_at = CURRENT_TIMESTAMP
		WHERE id = @id
		RETURNING *
	`);

	return statement.get({ ...filteredConversation, id }) as Conversation;
};

export const deleteConversation = (id: number) => {
	const transaction = db.transaction(() => {
		// Delete associated jobs first
		const deleteJobsStmt = db.prepare('DELETE FROM jobs WHERE conversation_id = ?');
		deleteJobsStmt.run(id);

		// Delete associated execution sessions (will cascade to session messages)
		const deleteSessionsStmt = db.prepare('DELETE FROM execution_sessions WHERE conversation_id = ?');
		deleteSessionsStmt.run(id);

		// Delete conversation messages (should cascade but being explicit)
		const deleteMessagesStmt = db.prepare('DELETE FROM conversation_messages WHERE conversation_id = ?');
		deleteMessagesStmt.run(id);

		// Delete the conversation
		const deleteConversationStmt = db.prepare('DELETE FROM conversations WHERE id = ?');
		return deleteConversationStmt.run(id);
	});

	return transaction();
};

export const addMessageToConversation = (message: ConversationMessage) => {
	const statement = db.prepare(`
		INSERT INTO conversation_messages (conversation_id, sequence, role, content, metadata)
		VALUES (@conversation_id, @sequence, @role, @content, @metadata)
		RETURNING *
	`);
	return statement.get(message) as ConversationMessage;
};

export const getConversationMessages = (conversationId: number) => {
	return db.prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY sequence').all(conversationId) as ConversationMessage[];
};

export const updateConversationMessage = (id: number, message: Partial<ConversationMessage>) => {
	const filteredMessage = Object.fromEntries(
		Object.entries(message).filter(([_, value]) => value !== undefined)
	);

	if (Object.keys(filteredMessage).length === 0) {
		return db.prepare('SELECT * FROM conversation_messages WHERE id = ?').get(id) as ConversationMessage;
	}

	const updates = Object.keys(filteredMessage)
		.filter(key => key !== 'id' && key !== 'created_at')
		.map(key => `${key} = @${key}`)
		.join(', ');

	const statement = db.prepare(`
		UPDATE conversation_messages
		SET ${updates}
		WHERE id = @id
		RETURNING *
	`);

	return statement.get({ ...filteredMessage, id }) as ConversationMessage;
};

export const deleteConversationMessage = (id: number) => {
	const statement = db.prepare('DELETE FROM conversation_messages WHERE id = ?');
	return statement.run(id);
};

export const reorderConversationMessages = (_conversationId: number, newOrder: { id: number; sequence: number }[]) => {
	const transaction = db.transaction(() => {
		const updateStmt = db.prepare('UPDATE conversation_messages SET sequence = ? WHERE id = ?');
		for (const { id, sequence } of newOrder) {
			updateStmt.run(sequence, id);
		}
	});

	return transaction();
};

export const createExecutionSession = (session: ExecutionSession) => {
	const statement = db.prepare(`
		INSERT INTO execution_sessions (
			conversation_id, agent_id, status, started_at, completed_at,
			success, error_message, metadata
		)
		VALUES (
			@conversation_id, @agent_id, @status, @started_at, @completed_at,
			@success, @error_message, @metadata
		)
		RETURNING *
	`);
	return statement.get(session) as ExecutionSession;
};

export const getExecutionSessions = (filters?: { conversation_id?: number; agent_id?: number; limit?: number; offset?: number }) => {
	let query = 'SELECT * FROM execution_sessions';
	const params: any[] = [];

	if (filters) {
		const conditions: string[] = [];
		if (filters.conversation_id) {
			conditions.push('conversation_id = ?');
			params.push(filters.conversation_id);
		}
		if (filters.agent_id) {
			conditions.push('agent_id = ?');
			params.push(filters.agent_id);
		}
		if (conditions.length > 0) {
			query += ' WHERE ' + conditions.join(' AND ');
		}
	}

	query += ' ORDER BY started_at DESC';

	if (filters?.limit !== undefined) {
		query += ' LIMIT ?';
		params.push(filters.limit);
	}
	if (filters?.offset !== undefined) {
		query += ' OFFSET ?';
		params.push(filters.offset);
	}

	return db.prepare(query).all(...params) as ExecutionSession[];
};

export const getExecutionSessionsWithCount = (filters?: { conversation_id?: number; agent_id?: number; limit?: number; offset?: number }): { data: ExecutionSession[]; total: number } => {
	// Get total count
	let countQuery = 'SELECT COUNT(*) as count FROM execution_sessions';
	const countParams: any[] = [];

	if (filters) {
		const conditions: string[] = [];
		if (filters.conversation_id) {
			conditions.push('conversation_id = ?');
			countParams.push(filters.conversation_id);
		}
		if (filters.agent_id) {
			conditions.push('agent_id = ?');
			countParams.push(filters.agent_id);
		}
		if (conditions.length > 0) {
			countQuery += ' WHERE ' + conditions.join(' AND ');
		}
	}

	const countResult = db.prepare(countQuery).get(...countParams) as { count: number };
	const total = countResult.count;

	// Get actual data
	const data = getExecutionSessions(filters);

	return { data, total };
};

export const getExecutionSessionById = (id: number) => {
	return db.prepare('SELECT * FROM execution_sessions WHERE id = ?').get(id) as ExecutionSession;
};

export const getExecutionSessionsByIds = (ids: number[]): ExecutionSession[] => {
	if (!ids || ids.length === 0) {
		return [];
	}
	const placeholders = ids.map(() => '?').join(',');
	const sql = `SELECT * FROM execution_sessions WHERE id IN (${placeholders})`;

	return db.prepare(sql).all(...ids) as ExecutionSession[];
};

export const updateExecutionSession = (id: number, session: Partial<ExecutionSession>) => {
	const filteredSession = Object.fromEntries(
		Object.entries(session).filter(([_, value]) => value !== undefined)
	);

	if (Object.keys(filteredSession).length === 0) {
		return getExecutionSessionById(id);
	}

	const updates = Object.keys(filteredSession)
		.filter(key => key !== 'id')
		.map(key => `${key} = @${key}`)
		.join(', ');

	const statement = db.prepare(`
		UPDATE execution_sessions
		SET ${updates}
		WHERE id = @id
		RETURNING *
	`);

	return statement.get({ ...filteredSession, id }) as ExecutionSession;
};

export const addSessionMessage = (message: SessionMessage) => {
	const statement = db.prepare(`
		INSERT INTO session_messages (session_id, sequence, role, content, timestamp, metadata)
		VALUES (@session_id, @sequence, @role, @content, @timestamp, @metadata)
		RETURNING *
	`);
	return statement.get(message) as SessionMessage;
};

export const getSessionMessages = (sessionId: number) => {
	return db.prepare('SELECT * FROM session_messages WHERE session_id = ? ORDER BY sequence').all(sessionId) as SessionMessage[];
};

export const getFullSessionTranscript = (sessionId: number) => {
	const session = getExecutionSessionById(sessionId);
	const messages = getSessionMessages(sessionId);

	return {
		session,
		messages
	};
};
