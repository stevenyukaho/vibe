import { frontendConfig } from '../runtimeConfig';

describe('runtimeConfig', () => {
	it('exports frontendConfig object', () => {
		expect(frontendConfig).toBeDefined();
		expect(typeof frontendConfig).toBe('object');
	});

	it('has apiUrl property', () => {
		expect(frontendConfig).toHaveProperty('apiUrl');
		expect(typeof frontendConfig.apiUrl).toBe('string');
	});
});

// Made with Bob
