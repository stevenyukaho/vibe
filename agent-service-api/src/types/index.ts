/**
 * Represents a conversation message
 */
export interface ConversationMessage {
	sequence: number;
	role: 'user' | 'system';
	content: string;
	metadata?: any;
}

/**
 * Represents a request to execute a test (legacy single prompt)
 */
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

/**
 * Represents a request to execute a conversation
 */
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
}

/**
 * Represents an intermediate step in the execution
 */
export interface IntermediateStep {
	timestamp: string;
	agent_id?: number;
	action: string;
	output: string;
}

/**
 * Represents metrics collected during test execution
 */
export interface Metrics {
	model_calls?: number;
	tool_calls?: number;
	execution_time: number;
	input_tokens?: number;
	output_tokens?: number;
}

/**
 * Represents a session message (actual conversation turn)
 */
export interface SessionMessage {
	sequence: number;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	timestamp: string;
	metadata?: any;
}

/**
 * Represents the response from a test execution (legacy)
 */
export interface TestExecutionResponse {
	agent_id?: number;
	test_id: number;
	output: string;
	success: boolean;
	execution_time: number;
	intermediate_steps: IntermediateStep[];
	metrics: Metrics;
}

/**
 * Represents the response from a conversation execution
 */
export interface ConversationExecutionResponse {
	agent_id?: number;
	conversation_id: number;
	transcript: SessionMessage[];
	success: boolean;
	execution_time: number;
	intermediate_steps: IntermediateStep[];
	metrics: Metrics;
}

/**
 * Represents a mapping for extracting data from API responses
 */
export interface ResponseMapping {
	output: string;
	intermediate_steps?: string;
	success_criteria?: {
		type: 'contains' | 'exact_match' | 'json_match';
		path?: string;
		operator?: string;
		value: any;
	};
}

/**
 * Represents a mapping for extracting token usage from API responses
 */
export interface TokenMapping {
	input_tokens?: string;
	output_tokens?: string;
	total_tokens?: string;
}
