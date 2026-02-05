describe('agent-service-api config', () => {
	it('exports config from loadAgentServiceApiConfig', () => {
		jest.resetModules();
		jest.doMock('@ibm-vibe/config', () => ({
			loadAgentServiceApiConfig: jest.fn().mockReturnValue({
				server: { port: 1234 },
				backend: { url: 'http://backend.test' },
				defaults: { requestTimeout: 1111, healthCheckInterval: 2222 }
			})
		}));

		const config = require('../index');

		expect(config.SERVER_CONFIG).toEqual({ port: 1234 });
		expect(config.BACKEND_CONFIG).toEqual({ url: 'http://backend.test' });
		expect(config.DEFAULT_TIMEOUT).toBe(1111);
		expect(config.HEALTH_CHECK_INTERVAL).toBe(2222);
	});
});
