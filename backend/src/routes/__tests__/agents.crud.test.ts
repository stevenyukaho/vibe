import agentRoutes from '../agents';
import * as queries from '../../db/queries';

jest.mock('../../db/queries');

const mockedQueries = queries as jest.Mocked<typeof queries> & {
	getAgents: jest.MockedFunction<typeof queries.getAgents>;
	getAgentById: jest.MockedFunction<typeof queries.getAgentById>;
	createAgent: jest.MockedFunction<typeof queries.createAgent>;
	updateAgent: jest.MockedFunction<typeof queries.updateAgent>;
	deleteAgent: jest.MockedFunction<typeof queries.deleteAgent>;
	getAgentsWithCount: jest.MockedFunction<typeof queries.getAgentsWithCount>;
};

type MockResponse = {
	statusCode: number;
	body?: unknown;
	status: (code: number) => MockResponse;
	json: (data: unknown) => MockResponse;
	send: (data?: unknown) => MockResponse;
};

const createMockResponse = (): MockResponse => {
	const res = {
		statusCode: 200,
		body: undefined,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		json(data: unknown) {
			this.body = data;
			return this;
		},
		send(data?: unknown) {
			this.body = data;
			return this;
		}
	} as MockResponse;
	return res;
};

const getRouteHandler = (router: any, method: 'get' | 'post' | 'put' | 'delete', path: string) => {
	const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
	if (!layer) {
		throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
	}
	return layer.route.stack[0].handle;
};

const callRoute = async (
	router: any,
	method: 'get' | 'post' | 'put' | 'delete',
	path: string,
	options?: { params?: Record<string, string>; query?: Record<string, string>; body?: Record<string, unknown> }
) => {
	const handler = getRouteHandler(router, method, path);
	const req = {
		params: options?.params ?? {},
		query: options?.query ?? {},
		body: options?.body ?? {}
	} as any;
	const res = createMockResponse();
	await handler(req, res);
	return res;
};

describe('agent CRUD routes', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /api/agents', () => {
		it('returns all agents without pagination', async () => {
			(mockedQueries.getAgents as any).mockReturnValue([
				{ id: 1, name: 'Agent 1', version: '1.0', prompt: 'p1', settings: '{}' },
				{ id: 2, name: 'Agent 2', version: '2.0', prompt: 'p2', settings: '{}' }
			]);

			const response = await callRoute(agentRoutes, 'get', '/');

			expect(response.statusCode).toBe(200);
			expect(response.body).toHaveLength(2);
		});

		it('returns paginated agents when pagination params provided', async () => {
			(mockedQueries.getAgentsWithCount as any).mockReturnValue({
				data: [{ id: 1, name: 'Agent 1', version: '1.0', prompt: 'p1', settings: '{}' }],
				total: 10
			});

			const response = await callRoute(agentRoutes, 'get', '/', {
				query: { limit: '5', offset: '0' }
			});

			expect(response.statusCode).toBe(200);
			expect((response.body as any).data).toHaveLength(1);
			expect((response.body as any).total).toBe(10);
			expect((response.body as any).limit).toBe(5);
			expect((response.body as any).offset).toBe(0);
		});

		it('handles errors gracefully', async () => {
			(mockedQueries.getAgents as any).mockImplementation(() => {
				throw new Error('Database error');
			});

			const response = await callRoute(agentRoutes, 'get', '/');

			expect(response.statusCode).toBe(500);
			expect((response.body as any).error).toBe('Failed to fetch agents');
		});
	});

	describe('GET /api/agents/:id', () => {
		it('returns agent by id', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue({
				id: 1,
				name: 'Test Agent',
				version: '1.0',
				prompt: 'test prompt',
				settings: '{}'
			});

			const response = await callRoute(agentRoutes, 'get', '/:id', {
				params: { id: '1' }
			});

			expect(response.statusCode).toBe(200);
			expect((response.body as any).name).toBe('Test Agent');
		});

		it('returns 404 when agent not found', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue(null);

			const response = await callRoute(agentRoutes, 'get', '/:id', {
				params: { id: '999' }
			});

			expect(response.statusCode).toBe(404);
			expect((response.body as any).error).toBe('Agent not found');
		});

		it('handles errors gracefully', async () => {
			(mockedQueries.getAgentById as any).mockImplementation(() => {
				throw new Error('Database error');
			});

			const response = await callRoute(agentRoutes, 'get', '/:id', {
				params: { id: '1' }
			});

			expect(response.statusCode).toBe(500);
			expect((response.body as any).error).toBe('Failed to fetch agent');
		});
	});

	describe('POST /api/agents', () => {
		it('creates a new agent with valid data', async () => {
			const newAgent = {
				name: 'New Agent',
				version: '1.0',
				prompt: 'test prompt',
				settings: '{}'
			};

			(mockedQueries.createAgent as any).mockReturnValue({
				id: 1,
				...newAgent,
				created_at: '2024-01-01'
			});

			const response = await callRoute(agentRoutes, 'post', '/', {
				body: newAgent
			});

			expect(response.statusCode).toBe(201);
			expect((response.body as any).id).toBe(1);
			expect((response.body as any).name).toBe('New Agent');
		});

		it('validates required fields', async () => {
			const response = await callRoute(agentRoutes, 'post', '/', {
				body: { name: 'Test' }
			});

			expect(response.statusCode).toBe(400);
			expect((response.body as any).error).toBe('Failed to create agent');
			expect((response.body as any).details).toContain('required fields');
		});

		it('validates settings is valid JSON', async () => {
			const response = await callRoute(agentRoutes, 'post', '/', {
				body: {
					name: 'Test',
					version: '1.0',
					prompt: 'prompt',
					settings: 'invalid json{'
				}
			});

			expect(response.statusCode).toBe(400);
			expect((response.body as any).details).toContain('valid JSON');
		});

		it('handles database errors', async () => {
			(mockedQueries.createAgent as any).mockImplementation(() => {
				throw new Error('Constraint violation');
			});

			const response = await callRoute(agentRoutes, 'post', '/', {
				body: {
					name: 'Test',
					version: '1.0',
					prompt: 'prompt',
					settings: '{}'
				}
			});

			expect(response.statusCode).toBe(500);
			expect((response.body as any).error).toBe('Failed to create agent');
		});
	});

	describe('PUT /api/agents/:id', () => {
		it('updates an existing agent', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue({
				id: 1,
				name: 'Old Name',
				version: '1.0',
				prompt: 'old prompt',
				settings: '{}'
			});

			(mockedQueries.updateAgent as any).mockReturnValue({
				id: 1,
				name: 'New Name',
				version: '1.0',
				prompt: 'old prompt',
				settings: '{}'
			});

			const response = await callRoute(agentRoutes, 'put', '/:id', {
				params: { id: '1' },
				body: { name: 'New Name' }
			});

			expect(response.statusCode).toBe(200);
			expect((response.body as any).name).toBe('New Name');
		});

		it('returns 404 when agent not found', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue(null);

			const response = await callRoute(agentRoutes, 'put', '/:id', {
				params: { id: '999' },
				body: { name: 'New Name' }
			});

			expect(response.statusCode).toBe(404);
			expect((response.body as any).error).toBe('Agent not found');
		});

		it('validates settings is valid JSON when provided', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue({
				id: 1,
				name: 'Test',
				version: '1.0',
				prompt: 'prompt',
				settings: '{}'
			});

			const response = await callRoute(agentRoutes, 'put', '/:id', {
				params: { id: '1' },
				body: { settings: 'invalid json{' }
			});

			expect(response.statusCode).toBe(400);
			expect((response.body as any).details).toContain('valid JSON');
		});

		it('handles database errors', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue({
				id: 1,
				name: 'Test',
				version: '1.0',
				prompt: 'prompt',
				settings: '{}'
			});

			(mockedQueries.updateAgent as any).mockImplementation(() => {
				throw new Error('Database error');
			});

			const response = await callRoute(agentRoutes, 'put', '/:id', {
				params: { id: '1' },
				body: { name: 'New Name' }
			});

			expect(response.statusCode).toBe(500);
			expect((response.body as any).error).toBe('Failed to update agent');
		});
	});

	describe('DELETE /api/agents/:id', () => {
		it('deletes an existing agent', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue({
				id: 1,
				name: 'Test',
				version: '1.0',
				prompt: 'prompt',
				settings: '{}'
			});

			(mockedQueries.deleteAgent as any).mockReturnValue(undefined);

			const response = await callRoute(agentRoutes, 'delete', '/:id', {
				params: { id: '1' }
			});

			expect(response.statusCode).toBe(204);
			expect(mockedQueries.deleteAgent).toHaveBeenCalledWith(1);
		});

		it('returns 404 when agent not found', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue(null);

			const response = await callRoute(agentRoutes, 'delete', '/:id', {
				params: { id: '999' }
			});

			expect(response.statusCode).toBe(404);
			expect((response.body as any).error).toBe('Agent not found');
		});

		it('handles database errors', async () => {
			(mockedQueries.getAgentById as any).mockReturnValue({
				id: 1,
				name: 'Test',
				version: '1.0',
				prompt: 'prompt',
				settings: '{}'
			});

			(mockedQueries.deleteAgent as any).mockImplementation(() => {
				throw new Error('Foreign key constraint');
			});

			const response = await callRoute(agentRoutes, 'delete', '/:id', {
				params: { id: '1' }
			});

			expect(response.statusCode).toBe(500);
			expect((response.body as any).error).toBe('Failed to delete agent');
		});
	});
});

// Made with Bob
