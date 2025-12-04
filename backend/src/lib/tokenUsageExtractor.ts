/**
 * Token usage extraction utility
 *
 * This module provides functions to extract token usage information from API responses.
 * It supports both explicit token mapping and automatic detection using popular formats.
 */

import type { TokenUsage, TokenMapping } from '@ibm-vibe/types';

/**
 * Popular token usage formats for automatic detection
 */
const POPULAR_TOKEN_FORMATS: TokenMapping[] = [
	// OpenAI & Mistral Format
	{
		input_tokens: 'usage.prompt_tokens',
		output_tokens: 'usage.completion_tokens',
		total_tokens: 'usage.total_tokens'
	},
	// Anthropic Claude Format
	{
		input_tokens: 'usage.input_tokens',
		output_tokens: 'usage.output_tokens'
	},
	// Google Gemini Format
	{
		input_tokens: 'usageMetadata.promptTokenCount',
		output_tokens: 'usageMetadata.candidatesTokenCount',
		total_tokens: 'usageMetadata.totalTokenCount'
	},
	// Cohere Format
	{
		input_tokens: 'meta.tokens.input_tokens',
		output_tokens: 'meta.tokens.output_tokens'
	},
	// Ollama Format
	{
		input_tokens: 'prompt_eval_count',
		output_tokens: 'eval_count'
	},
	// LangChain Format
	{
		input_tokens: 'llm_output.token_usage.prompt_tokens',
		output_tokens: 'llm_output.token_usage.completion_tokens',
		total_tokens: 'llm_output.token_usage.total_tokens'
	},
	// Alternative LangChain Format
	{
		input_tokens: 'token_usage.prompt_tokens',
		output_tokens: 'token_usage.completion_tokens',
		total_tokens: 'token_usage.total_tokens'
	}
];

/**
 * Extracts a value from an object using dot notation path
 * @param obj - The source object
 * @param path - Dot notation path (e.g., "usage.prompt_tokens")
 * @returns The extracted value or undefined
 */
function extractByPath(obj: any, path: string): any {
	try {
		const parts = path.split('.');
		let current = obj;

		for (const part of parts) {
			if (current === null || current === undefined) {
				return undefined;
			}
			// Handle array notation like "choices[0]"
			if (part.includes('[') && part.includes(']')) {
				const arrayName = part.substring(0, part.indexOf('['));
				const index = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')));
				current = current[arrayName];

				if (Array.isArray(current) && index >= 0 && index < current.length) {
					current = current[index];
				} else {
					return undefined;
				}
			} else {
				current = current[part];
			}
		}

		return current;
	} catch (error) {
		console.error('Error extracting path:', path, error);
		return undefined;
	}
}

/**
 * Attempts to extract token usage using a specific mapping
 * @param responseData - The API response data
 * @param mapping - Token mapping configuration
 * @returns TokenUsage object with extracted values
 */
function extractTokensWithMapping(responseData: any, mapping: TokenMapping): TokenUsage {
	const result: TokenUsage = {};

	if (mapping.input_tokens) {
		const value = extractByPath(responseData, mapping.input_tokens);
		const numValue = typeof value === 'string' ? parseFloat(value) : value;

		if (typeof numValue === 'number' && numValue >= 0 && !isNaN(numValue)) {
			result.input_tokens = Math.floor(numValue);
		}
	}

	if (mapping.output_tokens) {
		const value = extractByPath(responseData, mapping.output_tokens);
		const numValue = typeof value === 'string' ? parseFloat(value) : value;

		if (typeof numValue === 'number' && numValue >= 0 && !isNaN(numValue)) {
			result.output_tokens = Math.floor(numValue);
		}
	}

	if (mapping.total_tokens) {
		const value = extractByPath(responseData, mapping.total_tokens);
		const numValue = typeof value === 'string' ? parseFloat(value) : value;

		if (typeof numValue === 'number' && numValue >= 0 && !isNaN(numValue)) {
			result.total_tokens = Math.floor(numValue);
		}
	}

	// Compute total_tokens if not provided but we have input and output
	if (!result.total_tokens && result.input_tokens !== undefined && result.output_tokens !== undefined) {
		result.total_tokens = result.input_tokens + result.output_tokens;
	}

	return result;
}

/**
 * Extracts token usage from intermediate steps (for CrewAI/existing results)
 * @param intermediateSteps - JSON string or array of intermediate steps
 * @returns TokenUsage object
 */
function extractTokensFromIntermediateSteps(intermediateSteps: string | any[]): TokenUsage {
	try {
		let steps: any[];

		if (typeof intermediateSteps === 'string') {
			const parsed = JSON.parse(intermediateSteps);

			// Check if this is a direct metrics object (CrewAI format)
			if (parsed.metrics) {
				const metrics = parsed.metrics;

				return {
					input_tokens: undefined,
					output_tokens: undefined,
					total_tokens: metrics.token_usage || 0
				};
			}

			steps = Array.isArray(parsed) ? parsed : [parsed];
		} else {
			steps = Array.isArray(intermediateSteps) ? intermediateSteps : [intermediateSteps];
		}

		// Look for token usage in individual steps
		for (const step of steps) {
			if (step.metrics && typeof step.metrics.token_usage === 'number') {
				return {
					input_tokens: undefined,
					output_tokens: undefined,
					total_tokens: step.metrics.token_usage
				};
			}

			// Check for token usage information in step output
			if (step.output && typeof step.output === 'string') {
				// Look for patterns like "Total tokens used: 123"
				const tokenMatch = step.output.match(/Total tokens used:\s*(\d+)/i);
				if (tokenMatch) {
					return {
						input_tokens: undefined,
						output_tokens: undefined,
						total_tokens: parseInt(tokenMatch[1])
					};
				}

				// Look for patterns like "Estimated tokens: 123"
				const estimatedMatch = step.output.match(/Estimated tokens:\s*(\d+)/i);
				if (estimatedMatch) {
					return {
						input_tokens: undefined,
						output_tokens: undefined,
						total_tokens: parseInt(estimatedMatch[1])
					};
				}
			}
		}

		return {};
	} catch (error) {
		console.error('Error extracting tokens from intermediate steps:', error);
		return {};
	}
}

/**
 * Main function to extract token usage from API response
 * @param responseData - The API response data
 * @param tokenMapping - Optional explicit token mapping
 * @param intermediateSteps - Optional intermediate steps for fallback
 * @returns TokenUsage object and metadata
 */
export function extractTokenUsage(
	responseData: any,
	tokenMapping?: string | TokenMapping,
	intermediateSteps?: string | any[]
): { tokens: TokenUsage; metadata: any } {
	let tokens: TokenUsage = {};
	let metadata: any = {
		extraction_method: 'none',
		attempted_formats: [],
		success: false
	};

	// Try explicit token mapping first
	if (tokenMapping) {
		try {
			const mapping: TokenMapping = typeof tokenMapping === 'string'
				? JSON.parse(tokenMapping)
				: tokenMapping;

			tokens = extractTokensWithMapping(responseData, mapping);
			metadata.extraction_method = 'explicit_mapping';
			metadata.mapping_used = mapping;

			if (tokens.input_tokens !== undefined || tokens.output_tokens !== undefined) {
				metadata.success = true;
				return { tokens, metadata };
			}
		} catch (error) {
			console.error('Error parsing token mapping:', error);
			metadata.explicit_mapping_error = error instanceof Error ? error.message : 'Unknown error';
		}
	}

	// Try popular formats
	for (let i = 0; i < POPULAR_TOKEN_FORMATS.length; i++) {
		const format = POPULAR_TOKEN_FORMATS[i];
		metadata.attempted_formats.push(format);

		tokens = extractTokensWithMapping(responseData, format);

		if (tokens.input_tokens !== undefined || tokens.output_tokens !== undefined) {
			metadata.extraction_method = `popular_format_${i + 1}`;
			metadata.successful_format = format;
			metadata.success = true;

			return { tokens, metadata };
		}
	}

	// Try extracting from intermediate steps as fallback
	if (intermediateSteps) {
		tokens = extractTokensFromIntermediateSteps(intermediateSteps);
		if (tokens.input_tokens !== undefined || tokens.output_tokens !== undefined || tokens.total_tokens !== undefined) {
			metadata.extraction_method = 'intermediate_steps';
			metadata.success = true;

			return { tokens, metadata };
		}
	}

	metadata.extraction_method = 'failed';

	return { tokens: {}, metadata };
}

/**
 * Validates and sanitizes token usage values
 * @param tokens - Token usage object to validate
 * @returns Validated token usage object
 */
export function validateTokenUsage(tokens: TokenUsage): TokenUsage {
	const result: TokenUsage = {};

	if (tokens.input_tokens !== undefined && typeof tokens.input_tokens === 'number' && tokens.input_tokens >= 0) {
		result.input_tokens = Math.floor(tokens.input_tokens);
	}

	if (tokens.output_tokens !== undefined && typeof tokens.output_tokens === 'number' && tokens.output_tokens >= 0) {
		result.output_tokens = Math.floor(tokens.output_tokens);
	}

	// Compute total if we have both input and output
	if (result.input_tokens !== undefined && result.output_tokens !== undefined) {
		result.total_tokens = result.input_tokens + result.output_tokens;
	} else if (tokens.total_tokens !== undefined && typeof tokens.total_tokens === 'number' && tokens.total_tokens >= 0) {
		result.total_tokens = Math.floor(tokens.total_tokens);
	}

	return result;
}

/**
 * Helper function to get a summary of token usage for display
 * @param tokens - Token usage object
 * @returns Human-readable summary
 */
export function getTokenUsageSummary(tokens: TokenUsage): string {
	const parts: string[] = [];

	if (tokens.input_tokens !== undefined) {
		parts.push(`${tokens.input_tokens} input`);
	}

	if (tokens.output_tokens !== undefined) {
		parts.push(`${tokens.output_tokens} output`);
	}

	if (tokens.total_tokens !== undefined) {
		parts.push(`${tokens.total_tokens} total`);
	}

	return parts.length > 0 ? `${parts.join(', ')} tokens` : 'No token data';
}
