import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAgentById, getTestById, createResult } from '../db/queries';
import { agentService } from '../services/agent-service';

const router = Router();

interface ExecuteTestRequest {
  agent_id: number;
  test_id: number;
}

// Execute a test with a specific agent
router.post('/', (async (req: Request<{}, {}, ExecuteTestRequest>, res: Response) => {
  try {
    const { agent_id, test_id } = req.body;

    // Validate input
    if (!agent_id || !test_id) {
      return res.status(400).json({ error: 'agent_id and test_id are required' });
    }

    // Get agent and test from database
    const agent = await getAgentById(agent_id);
    const test = await getTestById(test_id);

    // Check if agent and test exist
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check if agent service is available
    const isHealthy = await agentService.healthCheck();
    if (!isHealthy) {
      return res.status(503).json({ error: 'Agent service is not available' });
    }

    // Execute the test
    const result = await agentService.executeTest(agent, test);

    // Save the result to the database
    const savedResult = await createResult(result);

    // Return the result
    res.status(201).json(savedResult);
  } catch (error) {
    console.error('Error executing test:', error);
    res.status(500).json({ error: 'Failed to execute test', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}) as any);

export default router; 