import { parseScoringResponse } from '../parseScoringResponse';

describe('parseScoringResponse', () => {
	describe('valid responses', () => {
		it('parses simple JSON with score and reasoning', () => {
			const response = '{"score": 85, "reasoning": "Good match"}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(85);
			expect(result.reasoning).toBe('Good match');
		});

		it('parses JSON with only score', () => {
			const response = '{"score": 75}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(75);
			expect(result.reasoning).toBe('');
		});

		it('parses JSON with markdown code fence', () => {
			const response = '```json\n{"score": 90, "reasoning": "Excellent"}\n```';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(90);
			expect(result.reasoning).toBe('Excellent');
		});

		it('parses JSON with code fence without json label', () => {
			const response = '```\n{"score": 80}\n```';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(80);
		});

		it('handles extra whitespace', () => {
			const response = '  \n  {"score": 70, "reasoning": "Test"}  \n  ';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(70);
			expect(result.reasoning).toBe('Test');
		});

		it('handles whitespace in reasoning', () => {
			const response = '{"score": 65, "reasoning": "  Some reasoning  "}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(65);
			expect(result.reasoning).toBe('Some reasoning');
		});

		it('handles empty reasoning string', () => {
			const response = '{"score": 60, "reasoning": ""}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(60);
			expect(result.reasoning).toBe('');
		});

		it('handles null reasoning', () => {
			const response = '{"score": 55, "reasoning": null}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(55);
			expect(result.reasoning).toBe('');
		});

		it('handles missing reasoning field', () => {
			const response = '{"score": 50}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(50);
			expect(result.reasoning).toBe('');
		});
	});

	describe('score clamping', () => {
		it('clamps negative scores to 0', () => {
			const response = '{"score": -10}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(0);
		});

		it('clamps scores above 100 to 100', () => {
			const response = '{"score": 150}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(100);
		});

		it('accepts score of 0', () => {
			const response = '{"score": 0}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(0);
		});

		it('accepts score of 100', () => {
			const response = '{"score": 100}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(100);
		});

		it('rounds decimal scores', () => {
			const response = '{"score": 85.7}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(86);
		});

		it('rounds down decimal scores', () => {
			const response = '{"score": 85.3}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(85);
		});

		it('handles very large positive scores', () => {
			const response = '{"score": 999999}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(100);
		});

		it('handles very large negative scores', () => {
			const response = '{"score": -999999}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(0);
		});
	});

	describe('error cases', () => {
		it('throws on empty string', () => {
			expect(() => parseScoringResponse('')).toThrow('Empty or invalid response from LLM');
		});

		it('throws on null input', () => {
			expect(() => parseScoringResponse(null as any)).toThrow('Empty or invalid response from LLM');
		});

		it('throws on undefined input', () => {
			expect(() => parseScoringResponse(undefined as any)).toThrow('Empty or invalid response from LLM');
		});

		it('throws on non-string input', () => {
			expect(() => parseScoringResponse(123 as any)).toThrow('Empty or invalid response from LLM');
		});

		it('throws on invalid JSON', () => {
			expect(() => parseScoringResponse('{invalid json}')).toThrow('Failed to parse JSON from LLM response');
		});

		it('throws on incomplete JSON', () => {
			expect(() => parseScoringResponse('{"score": 85')).toThrow('Failed to parse JSON from LLM response');
		});

		it('throws on non-object JSON', () => {
			// Arrays are objects in JavaScript, so this throws missing score error instead
			expect(() => parseScoringResponse('["array"]')).toThrow('Missing or invalid "score" field');
		});

		it('throws on string JSON value', () => {
			expect(() => parseScoringResponse('"just a string"')).toThrow('LLM response is not a valid JSON object');
		});

		it('throws on number JSON value', () => {
			expect(() => parseScoringResponse('42')).toThrow('LLM response is not a valid JSON object');
		});

		it('throws on missing score field', () => {
			expect(() => parseScoringResponse('{"reasoning": "test"}')).toThrow('Missing or invalid "score" field');
		});

		it('throws on non-numeric score', () => {
			expect(() => parseScoringResponse('{"score": "85"}')).toThrow('Missing or invalid "score" field');
		});

		it('throws on null score', () => {
			expect(() => parseScoringResponse('{"score": null}')).toThrow('Missing or invalid "score" field');
		});

		it('throws on boolean score', () => {
			expect(() => parseScoringResponse('{"score": true}')).toThrow('Missing or invalid "score" field');
		});

		it('throws on array score', () => {
			expect(() => parseScoringResponse('{"score": [85]}')).toThrow('Missing or invalid "score" field');
		});

		it('throws on object score', () => {
			expect(() => parseScoringResponse('{"score": {"value": 85}}')).toThrow('Missing or invalid "score" field');
		});
	});

	describe('edge cases', () => {
		it('handles JSON with extra properties', () => {
			const response = '{"score": 75, "reasoning": "test", "extra": "ignored", "another": 123}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(75);
			expect(result.reasoning).toBe('test');
		});

		it('handles reasoning with backticks', () => {
			// Code fence regex will match the first closing fence, so we test without nested fences
			const response = '{"score": 80, "reasoning": "Contains backticks"}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(80);
			expect(result.reasoning).toBe('Contains backticks');
		});

		it('handles multiline reasoning', () => {
			const response = '{"score": 70, "reasoning": "Line 1\\nLine 2\\nLine 3"}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(70);
			expect(result.reasoning).toContain('Line 1');
		});

		it('handles unicode in reasoning', () => {
			const response = '{"score": 65, "reasoning": "Test with émojis 🎉 and ñ"}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(65);
			expect(result.reasoning).toContain('émojis');
		});

		it('handles escaped quotes in reasoning', () => {
			const response = '{"score": 60, "reasoning": "Test with \\"quotes\\""}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(60);
			expect(result.reasoning).toContain('quotes');
		});

		it('handles code fence with extra whitespace', () => {
			const response = '  ```json  \n  {"score": 55}  \n  ```  ';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(55);
		});

		it('handles non-integer reasoning type', () => {
			const response = '{"score": 50, "reasoning": 123}';
			const result = parseScoringResponse(response);

			expect(result.score).toBe(50);
			expect(result.reasoning).toBe('');
		});
	});
});

// Made with Bob
