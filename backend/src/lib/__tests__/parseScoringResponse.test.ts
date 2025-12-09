import { parseScoringResponse } from '../parseScoringResponse';

describe('parseScoringResponse', () => {
	it('should parse valid JSON response', () => {
		const response = JSON.stringify({
			score: 85,
			reasoning: 'The outputs are very similar with minor differences in wording.'
		});

		const result = parseScoringResponse(response);

		expect(result).toEqual({
			score: 85,
			reasoning: 'The outputs are very similar with minor differences in wording.'
		});
	});

	it('should handle markdown code fences', () => {
		const response = `Here's my evaluation:

\`\`\`json
{
	"score": 92,
	"reasoning": "Both outputs convey the same meaning effectively."
}
\`\`\`

Hope this helps!`;

		const result = parseScoringResponse(response);

		expect(result).toEqual({
			score: 92,
			reasoning: 'Both outputs convey the same meaning effectively.'
		});
	});

	it('should handle code fences without language specifier', () => {
		const response = `\`\`\`
{
	"score": 67,
	"reasoning": "Some differences but generally similar."
}
\`\`\``;

		const result = parseScoringResponse(response);

		expect(result).toEqual({
			score: 67,
			reasoning: 'Some differences but generally similar.'
		});
	});

	it('should clamp scores below 0 to 0', () => {
		const response = JSON.stringify({
			score: -15,
			reasoning: 'Invalid negative score'
		});

		const result = parseScoringResponse(response);

		expect(result.score).toBe(0);
	});

	it('should clamp scores above 100 to 100', () => {
		const response = JSON.stringify({
			score: 150,
			reasoning: 'Invalid high score'
		});

		const result = parseScoringResponse(response);

		expect(result.score).toBe(100);
	});

	it('should round decimal scores to integers', () => {
		const response = JSON.stringify({
			score: 73.7,
			reasoning: 'Decimal score should be rounded'
		});

		const result = parseScoringResponse(response);

		expect(result.score).toBe(74);
	});

	it('should throw error for empty response', () => {
		expect(() => parseScoringResponse('')).toThrow('Empty or invalid response from LLM');
	});

	it('should throw error for non-string response', () => {
		expect(() => parseScoringResponse(null as any)).toThrow('Empty or invalid response from LLM');
	});

	it('should throw error for invalid JSON', () => {
		const response = 'This is not JSON';

		expect(() => parseScoringResponse(response)).toThrow('Failed to parse JSON from LLM response');
	});

	it('should throw error for missing score field', () => {
		const response = JSON.stringify({
			reasoning: 'Missing score field'
		});

		expect(() => parseScoringResponse(response)).toThrow('Missing or invalid "score" field in LLM response');
	});

	it('should throw error for non-numeric score', () => {
		const response = JSON.stringify({
			score: 'not a number',
			reasoning: 'Score should be numeric'
		});

		expect(() => parseScoringResponse(response)).toThrow('Missing or invalid "score" field in LLM response');
	});

	it('should throw error for missing reasoning field', () => {
		const response = JSON.stringify({
			score: 75
		});

		expect(() => parseScoringResponse(response)).toThrow('Missing or invalid "reasoning" field in LLM response');
	});

	it('should throw error for non-string reasoning', () => {
		const response = JSON.stringify({
			score: 75,
			reasoning: 123
		});

		expect(() => parseScoringResponse(response)).toThrow('Missing or invalid "reasoning" field in LLM response');
	});

	it('should handle whitespace around JSON', () => {
		const response = `   
		{
			"score": 88,
			"reasoning": "Well formatted with whitespace"
		}
		`;

		const result = parseScoringResponse(response);

		expect(result).toEqual({
			score: 88,
			reasoning: 'Well formatted with whitespace'
		});
	});

	it('should handle complex reasoning text', () => {
		const response = JSON.stringify({
			score: 55,
			reasoning: 'The outputs differ significantly. The expected output provides detailed instructions while the actual output is much more concise. However, they both address the same core question about data analysis.'
		});

		const result = parseScoringResponse(response);

		expect(result.score).toBe(55);
		expect(result.reasoning).toContain('differ significantly');
	});
});
