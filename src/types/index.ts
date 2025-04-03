/**
 * Represents a request to execute a test
 */
export interface TestExecutionRequest {
  test_input: string;
  test_id: number;
  api_endpoint: string;
  api_key?: string;
  request_template?: string;
  response_mapping?: string;
  headers?: Record<string, string>;
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
  token_usage?: number;
  model_calls?: number;
  tool_calls?: number;
  execution_time: number;
}

/**
 * Represents the response from a test execution
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
