import { getAgentJobType } from '../agent-utils';

describe('agent-utils', () => {
	describe('getAgentJobType', () => {
		it('returns crewai for crewai type', () => {
			const settings = JSON.stringify({ type: 'crewai' });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('returns external_api for external_api type', () => {
			const settings = JSON.stringify({ type: 'external_api' });
			expect(getAgentJobType(settings)).toBe('external_api');
		});

		it('defaults to crewai when type is missing', () => {
			const settings = JSON.stringify({ other: 'value' });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('defaults to crewai for empty settings object', () => {
			const settings = JSON.stringify({});
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('defaults to crewai for invalid JSON', () => {
			const settings = '{invalid json}';
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('defaults to crewai for empty string', () => {
			const settings = '';
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('defaults to crewai for unknown type', () => {
			const settings = JSON.stringify({ type: 'unknown_type' });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('defaults to crewai for null type', () => {
			const settings = JSON.stringify({ type: null });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('defaults to crewai for numeric type', () => {
			const settings = JSON.stringify({ type: 123 });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('handles settings with extra properties', () => {
			const settings = JSON.stringify({
				type: 'external_api',
				api_endpoint: 'https://example.com',
				timeout: 30000
			});
			expect(getAgentJobType(settings)).toBe('external_api');
		});

		it('handles whitespace in JSON', () => {
			const settings = '  { "type": "crewai" }  ';
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('is case-sensitive for type values', () => {
			const settings = JSON.stringify({ type: 'CrewAI' });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('handles boolean type value', () => {
			const settings = JSON.stringify({ type: true });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('handles array type value', () => {
			const settings = JSON.stringify({ type: ['crewai'] });
			expect(getAgentJobType(settings)).toBe('crewai');
		});

		it('handles object type value', () => {
			const settings = JSON.stringify({ type: { name: 'crewai' } });
			expect(getAgentJobType(settings)).toBe('crewai');
		});
	});
});

// Made with Bob
