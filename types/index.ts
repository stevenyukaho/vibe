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
	metadata?: string;
	created_at?: string;
}

export interface Conversation {
	id?: number;
	name: string;
	description?: string;
	tags?: string;
	expected_outcome?: string;
	created_at?: string;
	updated_at?: string;
	messages?: ConversationMessage[];
}

export interface SessionMessage {
	id?: number;
	session_id?: number;
	sequence: number;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	timestamp: string;
	metadata?: string;
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
