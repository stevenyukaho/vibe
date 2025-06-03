import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAgentById, getTestSuiteById } from '../db/queries';
import { jobQueue } from '../services/job-queue';

const router = Router();

interface ExecuteSuiteRequest {
	suite_id: number;
	agent_id: number;
}

/**
 * POST /api/execute-suite
 * Execute a suite of tests with the specified agent
 */
router.post('/', (async (req: Request, res: Response) => {
	try {
		const { suite_id, agent_id } = req.body as ExecuteSuiteRequest;
		
		// Validate required fields
		if (!suite_id) {
			return res.status(400).json({ error: 'suite_id is required' });
		}
		
		if (!agent_id) {
			return res.status(400).json({ error: 'agent_id is required' });
		}
		
		// Check if agent exists
		const agent = await getAgentById(agent_id);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}
		
		// Check if test suite exists
		const testSuite = await getTestSuiteById(suite_id);
		if (!testSuite) {
			return res.status(404).json({ error: "Test suite not found" });
		}
		
		// Create a suite run with jobs for all tests in the suite
		const suiteRunId = await jobQueue.createSuiteRun(suite_id, agent_id);
		
		res.json({
			message: "Suite execution started successfully",
			suite_run_id: suiteRunId,
			suite_id,
			agent_id
		});
	} catch (error) {
		console.error('Error executing suite:', error);
		res.status(500).json({ 
			error: 'Failed to execute test suite',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

export default router;
