export enum JobStatus {
	PENDING = 'pending',
	RUNNING = 'running',
	COMPLETED = 'completed',
	FAILED = 'failed',
	TIMEOUT = 'timeout'
}

export interface Agent {
	id?: number;
	name: string;
	version: string;
	prompt: string;
	settings: string;  // JSON string containing configuration settings
	created_at?: string;
}

export interface AgentRequestTemplate {
	id?: number;
	agent_id: number;
	name: string;
	description?: string;
	engine?: string;
	content_type?: string;
	body: string;
	tags?: string;
	is_default?: number | boolean;
	created_at?: string;
}

export interface AgentResponseMap {
	id?: number;
	agent_id: number;
	name: string;
	description?: string;
	spec: string;
	tags?: string;
	is_default?: number | boolean;
	created_at?: string;
}

// Legacy Test interface (kept for migration compatibility)
export interface Test {
	id?: number;
	name: string;
	description?: string;
	input: string;
	expected_output?: string;
	created_at?: string;
	updated_at?: string;
}

// Legacy TestResult interface (kept for migration compatibility)
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
	input_tokens?: number;  // Number of input tokens used
	output_tokens?: number;  // Number of output tokens generated
	token_mapping_metadata?: string;  // JSON metadata about token extraction process
}

// New Conversation interfaces
export interface Conversation {
	id?: number;
	name: string;
	description?: string;
	tags?: string; // JSON array for flexible categorization
	default_request_template_id?: number;
	default_response_map_id?: number;
	variables?: string; // JSON of conversation-level variables
	stop_on_failure?: boolean; // halt execution on per-turn failure
	created_at?: string;
	updated_at?: string;
}

export interface ConversationMessage {
	id?: number;
	conversation_id: number;
	sequence: number;
	role: 'user' | 'system';
	content: string;
	metadata?: string; // JSON for message-specific config
	request_template_id?: number;
	response_map_id?: number;
	set_variables?: string; // JSON for literal/bind variable assignments
	created_at?: string;
}

export interface ConversationTurnTarget {
	id?: number;
	conversation_id: number;
	user_sequence: number; // matches conversation_messages(sequence) for role='user'
	target_reply: string;
	threshold?: number | null; // 0 - 100
	weight?: number | null; // default 1.0
	created_at?: string;
	updated_at?: string;
}

export interface ExecutionSession {
	id?: number;
	conversation_id: number;
	agent_id: number;
	status: 'pending' | 'running' | 'completed' | 'failed';
	started_at?: string;
	completed_at?: string;
	success?: boolean;
	error_message?: string;
	metadata?: string; // JSON for session-level metrics (similarity scores, token usage, etc)
	variables?: string; // JSON snapshot of resolved variables during run
}

export interface SessionMessage {
	id?: number;
	session_id: number;
	sequence: number;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	timestamp?: string;
	metadata?: string; // JSON for timing, tokens, confidence, etc.
	// Per-turn similarity scoring (source of truth)
	similarity_score?: number; // 0 - 100
	similarity_scoring_status?: 'pending' | 'running' | 'completed' | 'failed';
	similarity_scoring_error?: string;
	similarity_scoring_metadata?: string; // JSON metadata
}

export interface Job {
	id: string;  // UUID
	agent_id: number;
	test_id?: number; // Legacy field (kept for compatibility)
	conversation_id?: number; // New field for conversation testing
	status: JobStatus;
	progress?: number;  // 0-100 percentage
	partial_result?: string;
	result_id?: number; // Legacy field (kept for compatibility)
	session_id?: number; // New field for execution sessions
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
	test_id?: number; // Legacy field
	conversation_id?: number;
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
	agent_name?: string;
	status: JobStatus;
	progress?: number;  // 0-100 percentage
	total_tests: number;
	completed_tests: number;
	successful_tests: number;
	failed_tests: number;
	average_execution_time?: number;  // Time in milliseconds
	avg_similarity_score?: number; // average similarity score for the run
	total_input_tokens?: number;  // Total input tokens for all tests in suite
	total_output_tokens?: number;  // Total output tokens for all tests in suite
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
	test_id?: number; // Legacy field
	conversation_id?: number;
	child_suite_id?: number;
	agent_id_override?: number;
}

// Additional shared types from root types/index.ts
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	limit?: number;
	offset?: number;
}

export interface StatsResponse {
	agents_total: number;
	tests_total: number;
}

export interface LLMRequestOptions {
	prompt: string;
	max_tokens?: number;
	temperature?: number;
	stop?: string[];
}

export interface LLMResponse {
	text: string;
	provider: string;
	model: string;
	config_id: number;
	error?: string;
}

export interface TokenUsage {
	input_tokens?: number;
	output_tokens?: number;
	total_tokens?: number;
}

export interface TokenMapping {
	input_tokens?: string;
	output_tokens?: string;
	total_tokens?: string;
}

export interface AgentSettings {
	type: string;
	api_endpoint: string;
	http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	headers?: Record<string, string>;
	api_key?: string;
	token_mapping?: string;
	request_template?: string; // Legacy
	response_mapping?: string; // Legacy
	[key: string]: any;
}

export interface TestExecutionRequest {
	test_input: string;
	test_id: number;
	api_endpoint: string;
	api_key?: string;
	request_template?: string;
	response_mapping?: string;
	token_mapping?: string;
	headers?: Record<string, string>;
	http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export interface ConversationExecutionRequest {
	conversation_id: number;
	conversation_script: ConversationMessage[];
	api_endpoint: string;
	api_key?: string;
	request_template?: string;
	response_mapping?: string;
	token_mapping?: string;
	headers?: Record<string, string>;
	http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	stop_on_failure?: boolean; // if true, halt on per-turn failure
}

export interface IntermediateStep {
	timestamp: string;
	agent_id?: number;
	action: string;
	output: string;
}

export interface Metrics {
	model_calls?: number;
	tool_calls?: number;
	execution_time: number;
	input_tokens?: number;
	output_tokens?: number;
}

export interface TestExecutionResponse {
	agent_id?: number;
	test_id: number;
	output: string;
	success: boolean;
	execution_time: number;
	intermediate_steps: IntermediateStep[];
	metrics: Metrics;
}

export interface ConversationExecutionResponse {
	agent_id?: number;
	conversation_id: number;
	transcript: SessionMessage[];
	success: boolean;
	execution_time: number;
	intermediate_steps: IntermediateStep[];
	variables?: Record<string, any>;
	metrics: Metrics;
}

export interface ResponseMapping {
	output?: string;
	intermediate_steps?: string;
	variables?: Record<string, string>;
	success_criteria?: {
		type: 'contains' | 'exact_match' | 'json_match';
		path?: string;
		operator?: string;
		value: any;
	};
}
