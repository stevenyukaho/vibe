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
