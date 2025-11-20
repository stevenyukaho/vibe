// shared types

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

// Conversations and sessions
export interface ConversationMessage {
	id?: number;
	conversation_id?: number;
	sequence: number;
	role: 'user' | 'system';
	content: string;
	metadata?: any; // Can be JSON string or parsed object
	created_at?: string;
}

export interface Conversation {
	id?: number;
	name: string;
	description?: string;
	tags?: string;
	created_at?: string;
	updated_at?: string;
	messages?: ConversationMessage[];
	default_request_template_id?: number;
	default_response_map_id?: number;
	variables?: string;
	stop_on_failure?: boolean;
}

export interface SessionMessage {
	id?: number;
	session_id?: number;
	sequence: number;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	timestamp: string;
	metadata?: any; // Can be JSON string or parsed object
	// Per-turn similarity scoring (source of truth)
	similarity_score?: number; // 0 - 100
	similarity_scoring_status?: 'pending' | 'running' | 'completed' | 'failed';
	similarity_scoring_error?: string;
	similarity_scoring_metadata?: string; // JSON metadata
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
	metadata?: string;
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

// Core entities reused across services
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

export interface Job {
	id: string;  // UUID
	agent_id: number;
	test_id?: number; // Legacy field
	conversation_id?: number; // New conversation-based execution
	status: JobStatus;
	progress?: number;  // 0-100 percentage
	partial_result?: string;
	result_id?: number; // Legacy field
	session_id?: number; // Execution session id for conversation jobs
	error?: string;
	created_at?: string;
	updated_at?: string;
	suite_run_id?: number; // Reference to parent suite run
	job_type?: string; // 'crewai' or 'external_api'
	claimed_by?: string; // Service identifier that claimed this job
	claimed_at?: string;
}

export interface Agent {
	id?: number;
	name: string;
	version: string;
	prompt: string;
	settings: string; // JSON string containing configuration settings
	created_at?: string;
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

export interface Test {
	id?: number;
	name: string;
	description?: string;
	input: string;
	expected_output?: string;
	created_at?: string;
	updated_at?: string;
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
