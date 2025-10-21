import type { Job, TestResult, SessionMessage } from './api';

/**
 * Get the primary ID for a job (session_id takes precedence over result_id)
 */
export const getJobId = (job: Job): number | null => {
	return job.session_id ?? job.result_id ?? null;
};

/**
 * Check if similarity scoring is currently active
 */
export const isScoringActive = (scoringStatus: string | null | undefined): boolean => {
	return scoringStatus === 'pending' || scoringStatus === 'running';
};

/**
 * Get Carbon Design System tag type based on status
 */
export const getStatusTagType = (status: string): 'green' | 'blue' | 'red' | 'purple' | 'gray' | 'cool-gray' => {
	switch (status.toLowerCase()) {
		case 'completed': return 'green';
		case 'running': return 'blue';
		case 'failed': return 'red';
		case 'pending': return 'purple';
		case 'queued': return 'purple';
		default: return 'gray';
	}
};

/**
 * Format token usage for display
 */
export const formatTokenUsage = (result: TestResult | null): string => {
	if (!result || (!result.input_tokens && !result.output_tokens)) {
		return '-';
	}

	const inputTokens = result.input_tokens || 0;
	const outputTokens = result.output_tokens || 0;
	const totalTokens = inputTokens + outputTokens;

	if (totalTokens === 0) {
		return '-';
	}

	if (inputTokens > 0 && outputTokens > 0) {
		return `${inputTokens} + ${outputTokens} = ${totalTokens}`;
	}

	return totalTokens.toString();
};

/**
 * Format token usage with detailed breakdown for modals
 */
export const formatTokenUsageDetailed = (result: TestResult | null): string => {
	if (!result || (!result.input_tokens && !result.output_tokens)) {
		return '';
	}

	const inputTokens = result.input_tokens || 0;
	const outputTokens = result.output_tokens || 0;
	const totalTokens = inputTokens + outputTokens;

	if (totalTokens === 0) {
		return '';
	}

	const parts: string[] = [];

	if (inputTokens > 0) {
		parts.push(`Input: ${inputTokens.toLocaleString()}`);
	}

	if (outputTokens > 0) {
		parts.push(`Output: ${outputTokens.toLocaleString()}`);
	}

	if (parts.length > 1) {
		parts.push(`Total: ${totalTokens.toLocaleString()}`);
	}

	return parts.join(' | ');
};

/**
 * Parse message metadata safely
 */
export const parseMessageMetadata = (message: SessionMessage): Record<string, any> => {
	try {
		return message.metadata ? JSON.parse(message.metadata) : {};
	} catch {
		return {};
	}
};

/**
 * Filter messages by role
 */
export const filterMessagesByRole = (messages: SessionMessage[], role: string): SessionMessage[] => {
	return messages.filter(m => m.role === role);
};

/**
 * Calculate total tokens from a message
 */
export const calculateMessageTokens = (message: SessionMessage): number => {
	const metadata = parseMessageMetadata(message);
	return (metadata.input_tokens || 0) + (metadata.output_tokens || 0);
};

/**
 * Calculate total tokens from multiple messages
 */
export const calculateTotalTokens = (messages: SessionMessage[]): { input: number; output: number; total: number } => {
	const totals = messages.reduce((acc, message) => {
		const metadata = parseMessageMetadata(message);
		return {
			input: acc.input + (metadata.input_tokens || 0),
			output: acc.output + (metadata.output_tokens || 0)
		};
	}, { input: 0, output: 0 });

	return {
		input: totals.input,
		output: totals.output,
		total: totals.input + totals.output
	};
};

/**
 * Calculate response time from message metadata
 */
export const calculateResponseTime = (message: SessionMessage, fallbackDuration?: number, totalAssistantMessages?: number): number => {
	const metadata = parseMessageMetadata(message);

	if (metadata.execution_time_ms) {
		return metadata.execution_time_ms;
	}

	// Fallback: estimate response time for assistant messages
	if (message.role === 'assistant' && fallbackDuration && totalAssistantMessages) {
		return fallbackDuration / totalAssistantMessages;
	}

	return 0;
};

/**
 * Find the first scored assistant message
 */
export const findScoredAssistantMessage = (messages: SessionMessage[]): SessionMessage | null => {
	const assistantMessages = filterMessagesByRole(messages, 'assistant');
	return assistantMessages.find(m =>
		m.similarity_scoring_status === 'completed' &&
		typeof m.similarity_score === 'number'
	) || null;
};
