import type { Request, Response } from 'express';

// Mock all dependencies before importing the router
jest.mock('../../db/queries');
jest.mock('../../services/job-queue');

import executeSuiteRouter from '../execute-suite';
import * as queries from '../../db/queries';
import { jobQueue } from '../../services/job-queue';

// Type the mocked functions
const mockGetAgentById = queries.getAgentById as jest.MockedFunction<typeof queries.getAgentById>;
const mockGetTestSuiteById = queries.getTestSuiteById as jest.MockedFunction<typeof queries.getTestSuiteById>;
const mockCreateSuiteRun = jobQueue.createSuiteRun as jest.MockedFunction<typeof jobQueue.createSuiteRun>;

describe('execute-suite routes', () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let jsonMock: jest.Mock;
	let statusMock: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		jsonMock = jest.fn();
		statusMock = jest.fn().mockReturnThis();

		mockReq = {
			body: {},
			params: {}
		};

		mockRes = {
			json: jsonMock,
			status: statusMock
		};
	});

	// Helper to extract and call route handler
	const getRouteHandler = (method: string, path: string) => {
		const routes = (executeSuiteRouter as any).stack;
		const route = routes.find((r: any) => {
			const routePath = r.route?.path;
			const routeMethod = r.route?.methods?.[method.toLowerCase()];
			return routePath === path && routeMethod;
		});
		return route?.route?.stack[0]?.handle;
	};

	const callRoute = async (method: string, path: string) => {
		const handler = getRouteHandler(method, path);
		if (!handler) throw new Error(`Route ${method} ${path} not found`);
		await handler(mockReq, mockRes);
	};

	describe('POST /api/execute-suite', () => {
		it('executes a test suite successfully', async () => {
			mockReq.body = { suite_id: 1, agent_id: 10 };

			(mockGetAgentById as any).mockResolvedValue({
				id: 10,
				name: 'Test Agent'
			});
			(mockGetTestSuiteById as any).mockResolvedValue({
				id: 1,
				name: 'Test Suite'
			});
			(mockCreateSuiteRun as any).mockResolvedValue(100);

			await callRoute('post', '/');

			expect(mockGetAgentById).toHaveBeenCalledWith(10);
			expect(mockGetTestSuiteById).toHaveBeenCalledWith(1);
			expect(mockCreateSuiteRun).toHaveBeenCalledWith(1, 10);
			expect(jsonMock).toHaveBeenCalledWith({
				message: 'Suite execution started successfully',
				suite_run_id: 100,
				suite_id: 1,
				agent_id: 10
			});
		});

		it('validates required suite_id field', async () => {
			mockReq.body = { agent_id: 10 };

			await callRoute('post', '/');

			expect(statusMock).toHaveBeenCalledWith(400);
			expect(jsonMock).toHaveBeenCalledWith({
				error: 'suite_id is required'
			});
		});

		it('validates required agent_id field', async () => {
			mockReq.body = { suite_id: 1 };

			await callRoute('post', '/');

			expect(statusMock).toHaveBeenCalledWith(400);
			expect(jsonMock).toHaveBeenCalledWith({
				error: 'agent_id is required'
			});
		});

		it('returns 404 when agent not found', async () => {
			mockReq.body = { suite_id: 1, agent_id: 999 };

			(mockGetAgentById as any).mockResolvedValue(null);

			await callRoute('post', '/');

			expect(statusMock).toHaveBeenCalledWith(404);
			expect(jsonMock).toHaveBeenCalledWith({
				error: 'Agent not found'
			});
		});

		it('returns 404 when test suite not found', async () => {
			mockReq.body = { suite_id: 999, agent_id: 10 };

			(mockGetAgentById as any).mockResolvedValue({
				id: 10,
				name: 'Test Agent'
			});
			(mockGetTestSuiteById as any).mockResolvedValue(null);

			await callRoute('post', '/');

			expect(statusMock).toHaveBeenCalledWith(404);
			expect(jsonMock).toHaveBeenCalledWith({
				error: 'Test suite not found'
			});
		});

		it('handles database errors gracefully', async () => {
			mockReq.body = { suite_id: 1, agent_id: 10 };

			(mockGetAgentById as any).mockRejectedValue(new Error('Database connection failed'));

			await callRoute('post', '/');

			expect(statusMock).toHaveBeenCalledWith(500);
			expect(jsonMock).toHaveBeenCalledWith({
				error: 'Failed to execute test suite',
				details: 'Database connection failed'
			});
		});

		it('handles unknown errors gracefully', async () => {
			mockReq.body = { suite_id: 1, agent_id: 10 };
			(mockGetAgentById as any).mockRejectedValue({ code: 'unknown' });

			await callRoute('post', '/');

			expect(statusMock).toHaveBeenCalledWith(500);
			expect(jsonMock).toHaveBeenCalledWith({
				error: 'Failed to execute test suite',
				details: 'Unknown error'
			});
		});

		it('handles job queue errors gracefully', async () => {
			mockReq.body = { suite_id: 1, agent_id: 10 };

			(mockGetAgentById as any).mockResolvedValue({
				id: 10,
				name: 'Test Agent'
			});
			(mockGetTestSuiteById as any).mockResolvedValue({
				id: 1,
				name: 'Test Suite'
			});
			(mockCreateSuiteRun as any).mockRejectedValue(new Error('Queue is full'));

			await callRoute('post', '/');

			expect(statusMock).toHaveBeenCalledWith(500);
			expect(jsonMock).toHaveBeenCalledWith({
				error: 'Failed to execute test suite',
				details: 'Queue is full'
			});
		});
	});
});

// Made with Bob
