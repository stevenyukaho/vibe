import { agentServiceConfig, serverConfig, dbConfig, paginationConfig } from '../config';

describe('config', () => {
	describe('agentServiceConfig', () => {
		it('should be defined', () => {
			expect(agentServiceConfig).toBeDefined();
		});

		it('should have required properties', () => {
			expect(agentServiceConfig).toHaveProperty('url');
			expect(agentServiceConfig).toHaveProperty('timeout');
		});

		it('should have valid url format', () => {
			expect(typeof agentServiceConfig.url).toBe('string');
			expect(agentServiceConfig.url.length).toBeGreaterThan(0);
		});

		it('should have valid timeout', () => {
			expect(typeof agentServiceConfig.timeout).toBe('number');
			expect(agentServiceConfig.timeout).toBeGreaterThanOrEqual(0);
		});
	});

	describe('serverConfig', () => {
		it('should be defined', () => {
			expect(serverConfig).toBeDefined();
		});

		it('should have required properties', () => {
			expect(serverConfig).toHaveProperty('port');
			expect(serverConfig).toHaveProperty('host');
		});

		it('should have valid port', () => {
			expect(typeof serverConfig.port).toBe('number');
			expect(serverConfig.port).toBeGreaterThan(0);
			expect(serverConfig.port).toBeLessThanOrEqual(65535);
		});

		it('should have valid host', () => {
			expect(typeof serverConfig.host).toBe('string');
			expect(serverConfig.host.length).toBeGreaterThan(0);
		});
	});

	describe('dbConfig', () => {
		it('should be defined', () => {
			expect(dbConfig).toBeDefined();
		});

		it('should have required properties', () => {
			expect(dbConfig).toHaveProperty('path');
		});

		it('should have valid path', () => {
			expect(typeof dbConfig.path).toBe('string');
			expect(dbConfig.path.length).toBeGreaterThan(0);
		});
	});

	describe('paginationConfig', () => {
		it('should be defined', () => {
			expect(paginationConfig).toBeDefined();
		});

		it('should have defaultLargeLimit property', () => {
			expect(paginationConfig).toHaveProperty('defaultLargeLimit');
		});

		it('should have valid defaultLargeLimit', () => {
			expect(typeof paginationConfig.defaultLargeLimit).toBe('number');
			expect(paginationConfig.defaultLargeLimit).toBeGreaterThan(0);
			expect(paginationConfig.defaultLargeLimit).toBe(50);
		});

		it('should be a reasonable pagination limit', () => {
			// Pagination limit should be between 1 and 1000 for practical use
			expect(paginationConfig.defaultLargeLimit).toBeGreaterThanOrEqual(1);
			expect(paginationConfig.defaultLargeLimit).toBeLessThanOrEqual(1000);
		});
	});

	describe('config integration', () => {
		it('should have all required config objects exported', () => {
			expect(agentServiceConfig).toBeDefined();
			expect(serverConfig).toBeDefined();
			expect(dbConfig).toBeDefined();
			expect(paginationConfig).toBeDefined();
		});

		it('should have consistent types across configs', () => {
			// All configs should be objects
			expect(typeof agentServiceConfig).toBe('object');
			expect(typeof serverConfig).toBe('object');
			expect(typeof dbConfig).toBe('object');
			expect(typeof paginationConfig).toBe('object');
		});

		it('should not have null or undefined configs', () => {
			expect(agentServiceConfig).not.toBeNull();
			expect(serverConfig).not.toBeNull();
			expect(dbConfig).not.toBeNull();
			expect(paginationConfig).not.toBeNull();

			expect(agentServiceConfig).not.toBeUndefined();
			expect(serverConfig).not.toBeUndefined();
			expect(dbConfig).not.toBeUndefined();
			expect(paginationConfig).not.toBeUndefined();
		});
	});
});

// Made with Bob
