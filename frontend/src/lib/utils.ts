import type { Job, TestResult, SessionMessage, Agent } from './api';

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

/**
 * Convert an Agent object to form data format for AgentFormModal
 */
export const agentToFormData = (agent: Agent | null | undefined): Record<string, string> => {
	if (!agent) {
		return {};
	}

	// Start with top-level fields
	const data: Record<string, string> = {
		'agent-name': agent.name || '',
		'agent-version': agent.version || '',
		'agent-prompt': agent.prompt || '',
		'agent-settings': agent.settings || ''
	};

	// Parse settings JSON and map to form fields
	try {
		const settings = agent.settings ? JSON.parse(agent.settings) : {};
		if (settings.type) data['agent-type'] = settings.type;

		// CrewAI fields
		if (settings.type === 'crew_ai' || settings.type === 'crewai') {
			data['agent-model'] = settings.model ?? '';
			data['agent-temperature'] = settings.temperature?.toString() ?? '';
			data['agent-max-tokens'] = settings.max_tokens?.toString() ?? '';
			data['agent-ollama-url'] = settings.base_url ?? '';
			data['agent-role'] = settings.role ?? '';
			data['agent-goal'] = settings.goal ?? '';
			data['agent-backstory'] = settings.backstory ?? '';
		}

		// External API fields
		if (settings.type === 'external_api') {
			data['agent-api-endpoint'] = settings.api_endpoint ?? '';
			data['agent-api-key'] = settings.api_key ?? '';
			data['agent-http-method'] = settings.http_method ?? 'POST';
			data['agent-request-template'] = settings.request_template ?? '';
			if (settings.response_mapping !== undefined) {
				data['agent-response-mapping'] = typeof settings.response_mapping === 'string'
					? settings.response_mapping
					: JSON.stringify(settings.response_mapping);
			}
			if (settings.headers !== undefined) {
				data['agent-headers'] = typeof settings.headers === 'string'
					? settings.headers
					: JSON.stringify(settings.headers);
			}
			if (settings.token_mapping !== undefined) {
				data['agent-token-mapping'] = typeof settings.token_mapping === 'string'
					? settings.token_mapping
					: JSON.stringify(settings.token_mapping);
			}
		}
	} catch {
		// If settings are invalid, ignore and use defaults
	}

	return data;
};
