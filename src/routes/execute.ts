import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAgentById, getTestById } from '../db/queries';
import { agentService } from '../services/agent-service';
import { jobQueue } from '../services/job-queue';

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

    // Check if CrewAI agent service is available if using CrewAI
    try {
      // Parse settings to determine agent type
      const settings = JSON.parse(agent.settings);
      
      // Only check health for CrewAI agents
      if (!settings.type || settings.type === 'crewai') {
        const isHealthy = await agentService.healthCheck();
        if (!isHealthy) {
          return res.status(503).json({ error: 'Agent service is not available' });
        }
      }
    } catch (error: any) {
      console.error('Error parsing agent settings:', error);
      return res.status(400).json({ error: 'Invalid agent settings' });
    }

    // Create a job to execute the test instead of executing directly
    const jobId = await jobQueue.createJob(agent_id, test_id);

    // Return the job ID with 202 Accepted status
    res.status(202).json({ 
      job_id: jobId,
      message: 'Test execution job created and queued for execution'
    });
  } catch (error: any) {
    console.error('Error executing test:', error);
    res.status(500).json({ error: 'Failed to execute test', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}) as any);

export default router; 