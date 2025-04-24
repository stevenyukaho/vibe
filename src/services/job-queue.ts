import { v4 as uuidv4 } from 'uuid';
import { 
  createJob as dbCreateJob, 
  getJobById, 
  updateJob as dbUpdateJob,
  listJobs as dbListJobs, 
  deleteOldJobs,
  deleteJob as dbDeleteJob,
  getAgentById,
  getTestById,
  createResult,
  getExecutionTimeByResultId
} from '../db/queries';
import { agentService } from './agent-service';
import { executeTest } from './agent-service-factory';

// Job status enum
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

// Job data structure
export interface Job {
  id: string;
  agent_id: number;
  test_id: number;
  status: JobStatus;
  progress?: number;
  partial_result?: string;
  result_id?: number;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

// Job filters for listing jobs
export interface JobFilters {
  status?: JobStatus;
  agent_id?: number;
  test_id?: number;
  before?: Date;
  after?: Date;
}

/**
 * Job Queue Service for managing asynchronous test execution
 */
export class JobQueueService {
  private jobs: Map<string, Job>;
  private runningJobs: Set<string>;
  private maxConcurrentJobs: number;
  private isProcessing: boolean;
  
  /**
   * Create a new JobQueueService
   * @param maxConcurrentJobs Maximum number of jobs to run concurrently
   */
  constructor(maxConcurrentJobs = 3) {
    this.jobs = new Map();
    this.runningJobs = new Set();
    this.maxConcurrentJobs = maxConcurrentJobs;
    this.isProcessing = false;
    
    // Initialize jobs from database
    this.loadJobsFromDatabase();
    
    // Start processing queue
    setInterval(() => this.processQueue(), 1000);
  }
  
  /**
   * Load jobs from database into memory
   */
  private async loadJobsFromDatabase() {
    try {
      const jobs = await dbListJobs({});
      for (const job of jobs) {
        if (job.status === JobStatus.RUNNING) {
          // Reset running jobs to pending on restart
          job.status = JobStatus.PENDING;
          await dbUpdateJob(job.id, { status: JobStatus.PENDING });
        }
        this.jobs.set(job.id, job);
      }
      console.log(`Loaded ${jobs.length} jobs from database`);
    } catch (error) {
      console.error('Error loading jobs from database:', error);
    }
  }
  
  /**
   * Create a new job and add it to the queue
   * @param agent_id Agent ID to use for the test
   * @param test_id Test ID to run
   * @param suite_run_id Optional suite run ID if this job is part of a suite run
   * @returns The job ID
   */
  async createJob(agent_id: number, test_id: number, suite_run_id?: number): Promise<string> {
    const id = uuidv4();
    const job: Job = {
      id,
      agent_id,
      test_id,
      status: JobStatus.PENDING,
      progress: 0
    };
    
    // Add suite_run_id if provided
    if (suite_run_id) {
      job.suite_run_id = suite_run_id;
    }
    
    // Save to database
    await dbCreateJob(job);
    
    // Add to in-memory queue
    this.jobs.set(id, job);
    
    // Start processing queue
    this.processQueue();
    
    return id;
  }
  
  /**
   * Get a job by ID
   * @param id Job ID
   * @returns The job or undefined if not found
   */
  async getJob(id: string): Promise<Job | undefined> {
    // Try memory first
    if (this.jobs.has(id)) {
      return this.jobs.get(id);
    }
    
    // Then try database
    try {
      const job = await getJobById(id);
      if (job) {
        this.jobs.set(id, job);
      }
      return job;
    } catch (error) {
      console.error(`Error getting job ${id}:`, error);
      return undefined;
    }
  }
  
  /**
   * Update a job's status and metadata
   * @param id Job ID
   * @param updates Fields to update
   */
  async updateJob(id: string, updates: Partial<Job>): Promise<void> {
    const job = await this.getJob(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }
    
    // Update in-memory job
    Object.assign(job, updates);
    this.jobs.set(id, job);
    
    // Update in database
    await dbUpdateJob(id, updates);
    
    // If job completed or failed, remove from running jobs
    if (updates.status === JobStatus.COMPLETED || 
        updates.status === JobStatus.FAILED ||
        updates.status === JobStatus.TIMEOUT) {
      this.runningJobs.delete(id);
    }
  }
  
  /**
   * Process the job queue
   */
  async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      // Get pending jobs
      const pendingJobs = Array.from(this.jobs.values())
        .filter(job => job.status === JobStatus.PENDING)
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      
      // Start jobs if we have capacity
      for (const job of pendingJobs) {
        if (this.runningJobs.size >= this.maxConcurrentJobs) {
          break;
        }
        
        // Mark job as running
        this.runningJobs.add(job.id);
        await this.updateJob(job.id, { status: JobStatus.RUNNING });
        
        // Execute job
        this.executeJob(job).catch(error => {
          console.error(`Error executing job ${job.id}:`, error);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Execute a single job
   * @param job The job to execute
   */
  private async executeJob(job: Job): Promise<void> {
    try {
      // Get agent and test
      const agent = await getAgentById(job.agent_id);
      const test = await getTestById(job.test_id);
      
      if (!agent || !test) {
        await this.updateJob(job.id, {
          status: JobStatus.FAILED,
          error: !agent ? 'Agent not found' : 'Test not found'
        });
        return;
      }
      
      // Update progress
      await this.updateJob(job.id, { progress: 10 });
      
      // Check if agent service is available for CrewAI agents
      try {
        const settings = JSON.parse(agent.settings);
        
        // Only check health for CrewAI agents
        if (!settings.type || settings.type === 'crewai') {
          const isHealthy = await agentService.healthCheck();
          if (!isHealthy) {
            await this.updateJob(job.id, {
              status: JobStatus.FAILED,
              error: 'Agent service is not available'
            });
            return;
          }
        }
      } catch (error: any) {
        await this.updateJob(job.id, {
          status: JobStatus.FAILED,
          error: `Invalid agent settings: ${error.message}`
        });
        return;
      }
      
      // Update progress
      await this.updateJob(job.id, { progress: 20 });
      
      // Execute test using the factory
      const result = await executeTest(agent, test);
      
      // Update progress
      await this.updateJob(job.id, { progress: 90 });
      
      // Save result
      const savedResult = await createResult(result);
      
      // Mark job as completed
      await this.updateJob(job.id, {
        status: JobStatus.COMPLETED,
        result_id: savedResult.id,
        progress: 100
      });
    } catch (error) {
      // Mark job as failed
      await this.updateJob(job.id, {
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        progress: 0
      });
    }
  }
  
  /**
   * List all jobs with optional filtering
   * @param filters Filters to apply
   * @returns List of jobs
   */
  async listJobs(filters: JobFilters = {}): Promise<Job[]> {
    try {
      const jobs = await dbListJobs(filters);
      // Update in-memory queue
      for (const job of jobs) {
        this.jobs.set(job.id, job);
      }
      return jobs;
    } catch (error) {
      console.error('Error listing jobs:', error);
      return [];
    }
  }
  
  /**
   * Clean up old completed jobs
   * @param olderThan Delete jobs older than this date
   */
  async cleanupOldJobs(olderThan: Date): Promise<void> {
    try {
      const deletedCount = await deleteOldJobs(olderThan);
      
      // Remove from in-memory queue
      for (const [id, job] of this.jobs.entries()) {
        if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
          const createdAt = job.created_at ? new Date(job.created_at) : new Date();
          if (createdAt < olderThan) {
            this.jobs.delete(id);
          }
        }
      }
      
      console.log(`Deleted ${deletedCount} old jobs`);
    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
    }
  }

  /**
   * Delete a job completely
   * @param id Job ID
   * @returns True if job was deleted, false if not found
   */
  async deleteJob(id: string): Promise<boolean> {
    // Remove from in-memory queue
    const job = await this.getJob(id);
    if (!job) {
      return false;
    }
    
    // Delete from database
    const deleted = await dbDeleteJob(id);
    
    if (deleted) {
      // Remove from in-memory maps
      this.jobs.delete(id);
      this.runningJobs.delete(id);
      return true;
    }
    
    return false;
  }

  /**
   * Create a new suite run and add jobs for all tests in the suite
   * @param suite_id Suite ID to run
   * @param agent_id Agent ID to use for the tests
   * @returns The suite run ID
   */
  async createSuiteRun(suite_id: number, agent_id: number): Promise<number> {
    // Get all tests in the suite
    const tests = dbQueries.getTestsInSuite(suite_id);
    
    if (!tests || tests.length === 0) {
      throw new Error(`No tests found in suite ${suite_id}`);
    }

    // Create suite run record
    const suiteRun: SuiteRun = {
      suite_id,
      agent_id,
      status: JobStatus.PENDING,
      progress: 0,
      total_tests: tests.length,
      completed_tests: 0,
      successful_tests: 0,
      failed_tests: 0
    };
    const createdSuiteRun = await dbQueries.createSuiteRun(suiteRun);
    if (!createdSuiteRun.id) {
      throw new Error('Failed to create suite run');
    }
    // Create jobs for each test in the suite
    const jobPromises = tests.map(test => 
      this.createJobForSuiteRun(agent_id, test.id!, createdSuiteRun.id!)
    );
    await Promise.all(jobPromises);
    // Immediately mark suite run as RUNNING
    await dbQueries.updateSuiteRun(createdSuiteRun.id, { status: JobStatus.RUNNING });
    // Start processing queue
    this.processQueue();
    return createdSuiteRun.id;
  }
  
  /**
   * Create a job for a test within a suite run
   * @param agent_id Agent ID to use
   * @param test_id Test ID to run
   * @param suite_run_id Suite run ID
   * @returns The job ID
   */
  private async createJobForSuiteRun(
    agent_id: number, 
    test_id: number, 
    suite_run_id: number
  ): Promise<string> {
    const id = uuidv4();
    const job: Job = {
      id,
      agent_id,
      test_id,
      status: JobStatus.PENDING,
      progress: 0,
      suite_run_id
    };
    
    // Save to database
    await dbCreateJob(job);
    
    // Add to in-memory queue
    this.jobs.set(id, job);
    
    return id;
  }
  
  /**
   * Update a suite run's progress based on completed jobs
   * @param suite_run_id Suite run ID
   */
  async updateSuiteRunProgress(suite_run_id: number): Promise<void> {
    // Get suite run
    const suiteRun = await dbQueries.getSuiteRunById(suite_run_id);
    if (!suiteRun) {
      throw new Error(`Suite run ${suite_run_id} not found`);
    }
    
    // Get all jobs for this suite run
    const jobs = await dbListJobs({ suite_run_id });
    
    // Calculate progress
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(job => 
      job.status === JobStatus.COMPLETED || 
      job.status === JobStatus.FAILED || 
      job.status === JobStatus.TIMEOUT
    );
    const successfulJobs = jobs.filter(job => job.status === JobStatus.COMPLETED);
    
    // Get results for completed jobs
    const executionTimes = completedJobs
      .map(job => job.result_id)
      .filter((id): id is number => id !== undefined && id !== null)
      .map(id => getExecutionTimeByResultId(id) || 0);
    
    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      : undefined;
    
    // Calculate overall progress percentage
    const progress = Math.floor((completedJobs.length / totalJobs) * 100);
    
    // Determine suite run status
    let status = suiteRun.status;
    if (completedJobs.length === totalJobs) {
      status = JobStatus.COMPLETED;
    } else if (jobs.some(job => job.status === JobStatus.RUNNING)) {
      status = JobStatus.RUNNING;
    }
    
    // Update suite run
    await dbQueries.updateSuiteRun(suite_run_id, {
      status,
      progress,
      completed_tests: completedJobs.length,
      successful_tests: successfulJobs.length,
      failed_tests: completedJobs.length - successfulJobs.length,
      average_execution_time: averageExecutionTime
    });
  }
}

// Export a singleton instance
export const jobQueue = new JobQueueService();
