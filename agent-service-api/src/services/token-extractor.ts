import type { TokenMapping, TokenUsage } from '../../../types';

/**
 * Popular token usage formats for automatic detection
 */
const POPULAR_TOKEN_FORMATS: TokenMapping[] = [
	// OpenAI & Mistral Format
	{
		input_tokens: 'usage.prompt_tokens',
		output_tokens: 'usage.completion_tokens'
	},
	// Anthropic Claude Format
	{
		input_tokens: 'usage.input_tokens',
		output_tokens: 'usage.output_tokens'
	},
	// Google Gemini Format
	{
		input_tokens: 'usageMetadata.promptTokenCount',
		output_tokens: 'usageMetadata.candidatesTokenCount'
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
		output_tokens: 'llm_output.token_usage.completion_tokens'
	},
	// Alternative LangChain Format
	{
		input_tokens: 'token_usage.prompt_tokens',
		output_tokens: 'token_usage.completion_tokens'
	}
];

/**
 * Extracts a value from an object using dot notation path
 */
function extractByPath(obj: any, path: string): any {
	try {
		const parts = path.split('.');
		let current = obj;

		for (const part of parts) {
			if (current === null || current === undefined) {
				return undefined;
			}
			current = current[part];
		}

		return current;
	} catch (error) {
		console.error('Error extracting path:', path, error);
		return undefined;
	}
}

/**
 * Attempts to extract token usage using a specific mapping
 */
function extractTokensWithMapping(responseData: any, mapping: TokenMapping): TokenUsage {
	const result: TokenUsage = {};

	if (mapping.input_tokens) {
		const value = extractByPath(responseData, mapping.input_tokens);
		if (typeof value === 'number' && value >= 0) {
			result.input_tokens = Math.floor(value);
		}
	}

	if (mapping.output_tokens) {
		const value = extractByPath(responseData, mapping.output_tokens);
		if (typeof value === 'number' && value >= 0) {
			result.output_tokens = Math.floor(value);
		}
	}

	return result;
}

/**
 * Main function to extract token usage from API response
 */
export function extractTokenUsage(
	responseData: any,
	tokenMapping?: string
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
			const mapping: TokenMapping = JSON.parse(tokenMapping);
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

	metadata.extraction_method = 'failed';
	return { tokens: {}, metadata };
}
