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
	similarity_score?: number;  // Similarity score (0-100)
	similarity_scoring_status?: 'pending' | 'running' | 'completed' | 'failed';  // Scoring job status
	similarity_scoring_error?: string;  // Error message if scoring failed
	similarity_scoring_metadata?: string;  // JSON metadata about the scoring process
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
	job_type?: string; // 'crewai' or 'external_api' for routing to appropriate service
	claimed_by?: string; // Service identifier that claimed this job
	claimed_at?: string;
}

export interface JobFilters {
	status?: JobStatus;
	agent_id?: number;
	test_id?: number;
	before?: Date;
	after?: Date;
	suite_run_id?: number;
	job_type?: string;
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
	total_execution_time?: number;  // Time in milliseconds
	avg_similarity_score?: number; // average similarity score for the run
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

export interface LLMConfig {
	id?: number;
	name: string;
	provider: string;
	config: string;  // JSON-stringified configuration object
	priority: number;
	created_at?: string;
	updated_at?: string;
}

// SuiteEntry represents a test or child suite entry in a nested suite structure
export interface SuiteEntry {
	id: number;
	parent_suite_id: number;
	sequence: number;
	test_id?: number;
	child_suite_id?: number;
	agent_id_override?: number;
}
