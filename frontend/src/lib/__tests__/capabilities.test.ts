import { capabilityNameToJson, getCapabilitySummary, extractCapabilityName } from '../capabilities';

describe('capabilities utilities', () => {
	describe('capabilityNameToJson', () => {
		it('converts valid capability name to JSON string', () => {
			const result = capabilityNameToJson('test-capability');
			expect(result).toBe('{"name":"test-capability"}');
		});

		it('trims whitespace from capability name', () => {
			const result = capabilityNameToJson('  test-capability  ');
			expect(result).toBe('{"name":"test-capability"}');
		});

		it('returns undefined for null', () => {
			const result = capabilityNameToJson(null);
			expect(result).toBeUndefined();
		});

		it('returns undefined for undefined', () => {
			const result = capabilityNameToJson(undefined);
			expect(result).toBeUndefined();
		});

		it('returns undefined for empty string', () => {
			const result = capabilityNameToJson('');
			expect(result).toBeUndefined();
		});

		it('returns undefined for whitespace-only string', () => {
			const result = capabilityNameToJson('   ');
			expect(result).toBeUndefined();
		});
	});

	describe('getCapabilitySummary', () => {
		it('returns array with capability name for valid string', () => {
			const result = getCapabilitySummary('test-capability');
			expect(result).toEqual(['test-capability']);
		});

		it('returns array with capability name for JSON object with name', () => {
			const result = getCapabilitySummary({ name: 'test-capability' });
			expect(result).toEqual(['test-capability']);
		});

		it('returns empty array for null', () => {
			const result = getCapabilitySummary(null);
			expect(result).toEqual([]);
		});

		it('returns empty array for undefined', () => {
			const result = getCapabilitySummary(undefined);
			expect(result).toEqual([]);
		});

		it('returns empty array for empty string', () => {
			const result = getCapabilitySummary('');
			expect(result).toEqual([]);
		});

		it('returns empty array for object without name', () => {
			const result = getCapabilitySummary({ other: 'value' });
			expect(result).toEqual([]);
		});
	});

	describe('extractCapabilityName', () => {
		it('extracts name from string', () => {
			const result = extractCapabilityName('test-capability');
			expect(result).toBe('test-capability');
		});

		it('extracts name from JSON object', () => {
			const result = extractCapabilityName({ name: 'test-capability' });
			expect(result).toBe('test-capability');
		});

		it('returns null for invalid input', () => {
			const result = extractCapabilityName(null);
			expect(result).toBeNull();
		});
	});
});

// Made with Bob
