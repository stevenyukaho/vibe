import { Router } from 'express';
import { Request, Response } from 'express';
import { apiService } from '../services/api-service';
import { TestExecutionRequest } from '@ibm-vibe/types';

const router = Router();

// Health check endpoint
router.get('/health', ((_req: Request, res: Response) => {
	res.status(200).json({ status: 'ok' });
}) as any);

// Execute test endpoint
router.post('/execute-test', (async (req: Request, res: Response) => {
	try {
		const request = req.body as TestExecutionRequest;

		// Validate required fields
		if (!request.test_input) {
			return res.status(400).json({ error: 'test_input is required' });
		}

		if (!request.api_endpoint) {
			return res.status(400).json({ error: 'api_endpoint is required' });
		}

		if (!request.test_id) {
			return res.status(400).json({ error: 'test_id is required' });
		}

		// Execute the test
		const result = await apiService.executeTest(request);

		// Return the result
		return res.status(200).json(result);
	} catch (error: any) {
		console.error('Error executing test:', error);
		return res.status(500).json({
			error: 'Failed to execute test',
			details: error.message || 'Unknown error'
		});
	}
}) as any);

export default router;
