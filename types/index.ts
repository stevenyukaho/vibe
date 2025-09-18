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
