import { api } from '../api';

describe('api client', () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		if (originalFetch) {
			global.fetch = originalFetch;
		}
		jest.resetAllMocks();
	});

	it('returns parsed payloads on success', async () => {
		const agents = [{ id: 1, name: 'Agent', version: '1.0', prompt: '', settings: '{}' }];
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => agents
		} as Response);

		await expect(api.getAgents()).resolves.toEqual(agents);
		expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/agents');
	});

	it('throws descriptive errors when the backend responds with an error', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			json: async () => ({ error: 'Failed to fetch agents' })
		} as Response);

		await expect(api.getAgents()).rejects.toThrow('Failed to fetch agents');
	});
});
