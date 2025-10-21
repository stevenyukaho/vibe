import type { Job, TestResult } from './api';

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
