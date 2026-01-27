import type { Request, Response } from 'express';

// Mock all dependencies before imports
jest.mock('../../db/queries');

import { getAgentsCount, getSingleTurnTestsCount } from '../../db/queries';

const mockGetAgentsCount = getAgentsCount as jest.MockedFunction<typeof getAgentsCount>;
const mockGetSingleTurnTestsCount = getSingleTurnTestsCount as jest.MockedFunction<typeof getSingleTurnTestsCount>;

describe('Stats Routes', () => {
	let statsRouter: any;
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let jsonMock: jest.Mock;
	let statusMock: jest.Mock;

	beforeEach(async () => {
		jest.clearAllMocks();

		// Reset modules to get fresh router
		jest.isolateModules(() => {
			statsRouter = require('../stats').default;
		});

		jsonMock = jest.fn();
		statusMock = jest.fn().mockReturnValue({ json: jsonMock });

		mockReq = {};

		mockRes = {
			json: jsonMock,
			status: statusMock
		};
	});

	const getRouteHandler = (method: string, path: string) => {
		const routes = statsRouter.stack || [];
		for (const layer of routes) {
			if (layer.route && layer.route.path === path) {
				const methodHandler = layer.route.stack.find((s: any) => s.method === method);
				if (methodHandler) {
					return methodHandler.handle;
				}
			}
		}
		throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
	};

	const callRoute = async (handler: any, req: Partial<Request>, res: Partial<Response>) => {
		await handler(req, res);
	};

	describe('GET /', () => {
		it('should return stats with agent and test counts', async () => {
			(mockGetAgentsCount as any).mockReturnValue(10);
			(mockGetSingleTurnTestsCount as any).mockReturnValue(25);

			const handler = getRouteHandler('get', '/');
			await callRoute(handler, mockReq, mockRes);

			expect(mockGetAgentsCount).toHaveBeenCalled();
			expect(mockGetSingleTurnTestsCount).toHaveBeenCalled();
			expect(jsonMock).toHaveBeenCalledWith({
				agents_total: 10,
				tests_total: 25
			});
		});

		it('should return zero counts when no data exists', async () => {
			(mockGetAgentsCount as any).mockReturnValue(0);
			(mockGetSingleTurnTestsCount as any).mockReturnValue(0);

			const handler = getRouteHandler('get', '/');
			await callRoute(handler, mockReq, mockRes);

			expect(jsonMock).toHaveBeenCalledWith({
				agents_total: 0,
				tests_total: 0
			});
		});

		it('should handle errors gracefully', async () => {
			(mockGetAgentsCount as any).mockImplementation(() => {
				throw new Error('Database error');
			});

			const handler = getRouteHandler('get', '/');
			await callRoute(handler, mockReq, mockRes);

			expect(statusMock).toHaveBeenCalledWith(500);
			expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to fetch stats' });
		});

		it('should handle errors from test count query', async () => {
			(mockGetAgentsCount as any).mockReturnValue(10);
			(mockGetSingleTurnTestsCount as any).mockImplementation(() => {
				throw new Error('Database error');
			});

			const handler = getRouteHandler('get', '/');
			await callRoute(handler, mockReq, mockRes);

			expect(statusMock).toHaveBeenCalledWith(500);
			expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to fetch stats' });
		});
	});
});

// Made with Bob
