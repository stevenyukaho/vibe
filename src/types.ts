// Common types used across the application

// Job status enum
export enum JobStatus {
	PENDING = 'pending',
	RUNNING = 'running',
	COMPLETED = 'completed',
	FAILED = 'failed',
	TIMEOUT = 'timeout'
}

// Basic interfaces
export interface Agent {
	id?: number;
	name: string;
	version: string;
	prompt: string;
	settings: string;  // JSON string containing configuration settings
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
	intermediate_steps?: string;  // JSON string containing intermediate processing steps
	success: boolean;
	execution_time?: number;  // Time in milliseconds
	created_at?: string;
}

export interface Job {
	id: string;  // UUID
	agent_id: number;
	test_id: number;
	status: JobStatus;
	progress?: number;  // 0-100 percentage
	partial_result?: string;
	result_id?: number;
	error?: string;
	created_at?: string;
	updated_at?: string;
	suite_run_id?: number; // Reference to parent suite run
}

export interface JobFilters {
	status?: JobStatus;
	agent_id?: number;
	test_id?: number;
	before?: Date;
	after?: Date;
}

// Test Suite interfaces
export interface TestSuite {
	id?: number;
	name: string;
	description?: string;
	tags?: string; // Comma-separated tags for categorization
	created_at?: string;
	updated_at?: string;
}

export interface TestSuiteTest {
	id?: number;
	suite_id: number;
	test_id: number;
	sequence?: number; // Ordering within suite
}

export interface SuiteRun {
	id?: number;
	suite_id: number;
	agent_id: number;
	status: JobStatus;
	progress?: number;  // 0-100 percentage
	total_tests: number;
	completed_tests: number;
	successful_tests: number;
	failed_tests: number;
	average_execution_time?: number;  // Time in milliseconds
	started_at?: string;
	completed_at?: string;
}

export interface SuiteRunFilters {
	status?: JobStatus;
	suite_id?: number;
	agent_id?: number;
	before?: Date;
	after?: Date;
}
