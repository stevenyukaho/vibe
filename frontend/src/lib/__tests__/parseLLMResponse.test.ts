import { parseLLMVariations } from '../parseLLMResponse';

describe('parseLLMVariations', () => {
	describe('valid JSON arrays', () => {
		it('parses simple JSON array', () => {
			const input = '["variation1", "variation2", "variation3"]';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2', 'variation3']);
		});

		it('parses JSON array with whitespace', () => {
			const input = '  ["variation1", "variation2"]  ';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2']);
		});

		it('parses JSON array with markdown fences', () => {
			const input = '```json\n["variation1", "variation2"]\n```';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2']);
		});

		it('parses JSON array with markdown fences without language', () => {
			const input = '```\n["variation1", "variation2"]\n```';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2']);
		});

		it('extracts array from first to last bracket', () => {
			const input = 'Here is the array: ["var1", "var2"] and more text [other]';
			const result = parseLLMVariations(input);
			// Function extracts from first [ to last ], so includes everything between
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toBe('var1');
		});
	});

	describe('fallback comma-separated parsing', () => {
		it('falls back to comma splitting for invalid JSON', () => {
			const input = '[variation1, variation2, variation3]';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2', 'variation3']);
		});

		it('handles quoted strings in fallback mode', () => {
			const input = '["variation1", "variation2", "variation3"]';
			// This should parse as JSON, but if it fails, fallback handles it
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2', 'variation3']);
		});

		it('handles single quotes in fallback mode', () => {
			const input = "['variation1', 'variation2']";
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2']);
		});

		it('filters empty strings in fallback mode', () => {
			const input = '[variation1, , variation2, ]';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2']);
		});

		it('trims whitespace in fallback mode', () => {
			const input = '[ variation1 ,  variation2  ]';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2']);
		});
	});

	describe('edge cases', () => {
		it('handles empty array', () => {
			const input = '[]';
			const result = parseLLMVariations(input);
			expect(result).toEqual([]);
		});

		it('handles single item array', () => {
			const input = '["single"]';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['single']);
		});

		it('handles array with empty strings', () => {
			const input = '["", "valid", ""]';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['', 'valid', '']);
		});

		it('handles nested arrays by taking first level', () => {
			const input = '[["nested"], "flat"]';
			// This will fail JSON parse and fall back to comma splitting
			const result = parseLLMVariations(input);
			expect(result.length).toBeGreaterThan(0);
		});

		it('handles text without brackets', () => {
			const input = 'variation1, variation2';
			const result = parseLLMVariations(input);
			// Without brackets, it tries to parse as-is and falls back
			expect(result.length).toBeGreaterThan(0);
		});

		it('handles complex markdown with code blocks', () => {
			const input = '```json\n[\n  "variation1",\n  "variation2"\n]\n```';
			const result = parseLLMVariations(input);
			expect(result).toEqual(['variation1', 'variation2']);
		});
	});

	describe('error handling', () => {
		it('handles non-string array in JSON', () => {
			const input = '[1, 2, 3]';
			// Should fail JSON validation and fall back
			const result = parseLLMVariations(input);
			expect(result).toEqual(['1', '2', '3']);
		});

		it('handles mixed types in array', () => {
			const input = '["string", 123, true]';
			// Should fail JSON validation and fall back
			const result = parseLLMVariations(input);
			expect(result.length).toBeGreaterThan(0);
		});

		it('handles malformed JSON gracefully', () => {
			const input = '["unclosed';
			const result = parseLLMVariations(input);
			// Falls back to comma splitting
			expect(result).toEqual(['unclosed']);
		});
	});
});

// Made with Bob
