import type { TokenMapping, TokenUsage } from '@ibm-vibe/types';

export type PathToken = string | number;

/**
 * Tokenizes a path string into property names and numeric indices.
 * Supports dot notation (a.b.c) and bracket notation (a[0]["key"]).
 */
export const tokenizePath = (path: string): PathToken[] => {
	const tokens: PathToken[] = [];
	const dotParts = path.split('.');

	for (const part of dotParts) {
		const regex = /([^\[\]]+)|\[(\d+|'.*?'|".*?")\]/g;
		let match: RegExpExecArray | null;

		while ((match = regex.exec(part)) !== null) {
			if (match[1]) {
				tokens.push(match[1]);
			} else if (match[2]) {
				const raw = match[2];
				if (/^\d+$/.test(raw)) {
					tokens.push(Number(raw));
				} else {
					tokens.push(String(raw).slice(1, -1));
				}
			}
		}
	}

	return tokens;
};

/**
 * Traverses an object using pre-tokenized path segments.
 */
export const traverseByTokens = (obj: unknown, tokens: PathToken[]): unknown => {
	let current: unknown = obj;
	for (const token of tokens) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof token === 'number') {
			if (Array.isArray(current)) {
				current = current[token];
			} else if (typeof current === 'object') {
				current = (current as Record<string, unknown>)[String(token)];
			} else {
				return undefined;
			}
		} else {
			if (typeof current === 'object' && current !== null) {
				current = (current as Record<string, unknown>)[token];
			} else {
				return undefined;
			}
		}
	}
	return current;
};

/**
 * Extracts a nested value by dot/bracket path.
 */
export const extractByPath = (obj: unknown, path: string): unknown => {
	try {
		if (!path || typeof path !== 'string') {
			return undefined;
		}
		return traverseByTokens(obj, tokenizePath(path));
	} catch {
		return undefined;
	}
};

export const parseTokenMapping = (tokenMapping?: string | TokenMapping): TokenMapping | undefined => {
	if (!tokenMapping) {
		return undefined;
	}

	if (typeof tokenMapping === 'string') {
		return JSON.parse(tokenMapping) as TokenMapping;
	}

	return tokenMapping;
};

const toValidTokenNumber = (value: unknown, parseNumericStrings: boolean): number | undefined => {
	const raw = parseNumericStrings && typeof value === 'string' ? Number.parseFloat(value) : value;
	if (typeof raw !== 'number' || Number.isNaN(raw) || raw < 0) {
		return undefined;
	}
	return Math.floor(raw);
};

export interface TokenExtractionOptions {
	parseNumericStrings?: boolean;
	includeTotalTokens?: boolean;
	computeTotalTokens?: boolean;
}

/**
 * Extract tokens from an API response using a configured path mapping.
 */
export const extractTokensWithMapping = (
	responseData: unknown,
	mapping: TokenMapping,
	options: TokenExtractionOptions = {}
): TokenUsage => {
	const parseNumericStrings = options.parseNumericStrings ?? false;
	const includeTotalTokens = options.includeTotalTokens ?? true;
	const computeTotalTokens = options.computeTotalTokens ?? true;
	const result: TokenUsage = {};

	if (mapping.input_tokens) {
		const value = extractByPath(responseData, mapping.input_tokens);
		const token = toValidTokenNumber(value, parseNumericStrings);
		if (token !== undefined) {
			result.input_tokens = token;
		}
	}

	if (mapping.output_tokens) {
		const value = extractByPath(responseData, mapping.output_tokens);
		const token = toValidTokenNumber(value, parseNumericStrings);
		if (token !== undefined) {
			result.output_tokens = token;
		}
	}

	if (includeTotalTokens && mapping.total_tokens) {
		const value = extractByPath(responseData, mapping.total_tokens);
		const token = toValidTokenNumber(value, parseNumericStrings);
		if (token !== undefined) {
			result.total_tokens = token;
		}
	}

	if (
		computeTotalTokens &&
		result.total_tokens === undefined &&
		result.input_tokens !== undefined &&
		result.output_tokens !== undefined
	) {
		result.total_tokens = result.input_tokens + result.output_tokens;
	}

	return result;
};
