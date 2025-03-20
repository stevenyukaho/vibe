import { Router } from 'express';
import type { Request, Response } from 'express';
import { jobQueue, JobStatus, JobFilters } from '../services/job-queue';
import { getAgentById, getTestById, getResultById } from '../db/queries';

const router = Router();

// List all jobs with optional filtering
router.get('/', (async (req: Request, res: Response) => {
  try {
    const filters: JobFilters = {};
    
    // Apply filters from query parameters
    if (req.query.status) {
      // Convert string to JobStatus enum
      filters.status = req.query.status as JobStatus;
    }
    
    if (req.query.agent_id) {
      filters.agent_id = parseInt(req.query.agent_id as string, 10);
    }
    
    if (req.query.test_id) {
      filters.test_id = parseInt(req.query.test_id as string, 10);
    }
    
    if (req.query.before) {
      filters.before = new Date(req.query.before as string);
    }
    
    if (req.query.after) {
      filters.after = new Date(req.query.after as string);
    }
    
    const jobs = await jobQueue.listJobs(filters);
    res.json(jobs);
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ 
      error: 'Failed to list jobs', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}) as any);

// Get a job by ID
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const job = await jobQueue.getJob(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Enrich job with related data if needed
    const enrichedJob: any = { ...job };
    
    // If job has a result, include it
    if (job.result_id) {
      enrichedJob.result = await getResultById(job.result_id);
    }
    
    res.json(enrichedJob);
  } catch (error) {
    console.error(`Error getting job ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Failed to get job', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}) as any);

// Create a new job to execute a test
router.post('/', (async (req: Request, res: Response) => {
  try {
    const { agent_id, test_id } = req.body;
    
    // Validate input
    if (!agent_id || !test_id) {
      return res.status(400).json({ error: 'agent_id and test_id are required' });
    }
    
    // Check if agent and test exist
    const agent = await getAgentById(agent_id);
    const test = await getTestById(test_id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Create a new job
    const jobId = await jobQueue.createJob(agent_id, test_id);
    
    // Return the job ID with 202 Accepted status
    res.status(202).json({ 
      job_id: jobId,
      message: 'Job created and queued for execution'
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ 
      error: 'Failed to create job', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}) as any);

// Cancel a job
router.delete('/:id', (async (req: Request, res: Response) => {
  try {
    const job = await jobQueue.getJob(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Only pending or running jobs can be canceled
    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.RUNNING) {
      return res.status(400).json({ 
        error: 'Cannot cancel job', 
        details: `Job status is ${job.status}` 
      });
    }
    
    // Update job status to canceled
    await jobQueue.updateJob(req.params.id, { 
      status: JobStatus.FAILED,
      error: 'Job canceled by user'
    });
    
    res.status(200).json({ message: 'Job canceled successfully' });
  } catch (error) {
    console.error(`Error canceling job ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Failed to cancel job', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}) as any);

export default router;
