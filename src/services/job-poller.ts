import axios from 'axios';
import { apiService } from './api-service';
import { TestExecutionRequest } from '../types';
import { BACKEND_CONFIG } from '../config';

// Using the same interfaces as defined in the backend for consistency
// Note: These should ideally be imported from a shared types package TODO
export interface Job {
	id: string;  // UUID
	agent_id: number;
	test_id: number;
	status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
	progress?: number;  // 0-100 percentage
	partial_result?: string;
	result_id?: number;
	error?: string;
	created_at?: string;
	updated_at?: string;
	suite_run_id?: number; // Reference to parent suite run
	job_type?: string; // 'crewai' or 'external_api'
	claimed_by?: string; // Service identifier that claimed this job
	claimed_at?: string;
}

export interface Agent {
	id?: number;
	name: string;
	version: string;
	prompt: string;
	settings: string; // JSON string containing configuration settings
	created_at?: string;
}

export interface Test {
	id?: number;
	name: string;
	description?: string;
	input: string;
	expected_output?: string;
	created_at?: string;
	updated_at?: string;
}

/**
 * Job Poller Service - Polls backend for jobs and executes them using ApiService
 */
export class JobPollerService {
	private backendUrl: string;
	private serviceId: string;
	private isPolling: boolean = false;
	private pollingInterval: NodeJS.Timeout | null = null;
	private isCurrentlyPolling: boolean = false;

	constructor(backendUrl: string = BACKEND_CONFIG.url, serviceId: string = 'agent-service-api') {
		this.backendUrl = backendUrl;
		this.serviceId = serviceId;
	}

	/**
	 * Start polling for jobs
	 */
	startPolling(intervalMs: number = 5000): void {
		if (this.isPolling) {
			return;
		}

		this.isPolling = true;

		this.pollingInterval = setInterval(async () => {
			if (this.isCurrentlyPolling) {
				return;
			}
			await this.pollAndExecuteJobs();
		}, intervalMs);

		this.pollAndExecuteJobs();
	}

	/**
	 * Stop polling for jobs
	 */
	stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
		this.isPolling = false;
	}

	/**
	 * Poll for available jobs and execute them
	 */
	private async pollAndExecuteJobs(): Promise<void> {
		if (this.isCurrentlyPolling) {
			return;
		}

		this.isCurrentlyPolling = true;
		
		try {
			// Get available jobs for external API type
			const response = await axios.get(`${this.backendUrl}/api/jobs/available/external_api?limit=5`);
			const jobs: Job[] = response.data;

			if (jobs.length === 0) {
				return; // No jobs available
			}

			// Process each job
			for (const job of jobs) {
				await this.executeJob(job);
			}
		} catch (error: any) {
			console.error('Error polling for jobs:', error);
		} finally {
			this.isCurrentlyPolling = false;
		}
	}

	/**
	 * Execute a single job
	 */
	private async executeJob(job: Job): Promise<void> {
		try {
			// Claim the job
			const claimResponse = await axios.post(`${this.backendUrl}/api/jobs/${job.id}/claim`, {
				service_id: this.serviceId
			});

			if (claimResponse.status !== 200) {
				return;
			}

			// Get agent and test details
			const [agentResponse, testResponse] = await Promise.all([
				axios.get(`${this.backendUrl}/api/agents/${job.agent_id}`),
				axios.get(`${this.backendUrl}/api/tests/${job.test_id}`)
			]);

			const agent: Agent = agentResponse.data;
			const test: Test = testResponse.data;

			const settings = JSON.parse(agent.settings);

			const agentType = settings.type;

			if (agentType !== 'external_api') {
				const errorMsg = `Job ${job.id} is not for external API agent (type: ${agentType})`;
				console.warn(errorMsg);
				await this.updateJobStatus(job.id, 'failed', 0, undefined, errorMsg);
				return;
			}

			await this.updateJobStatus(job.id, 'running', 10);

			const executionRequest: TestExecutionRequest = {
				test_id: test.id!,
				test_input: test.input,
				api_endpoint: settings.api_endpoint,
				http_method: settings.http_method,
				headers: settings.headers,
				api_key: settings.api_key,
				request_template: settings.request_template,
				response_mapping: settings.response_mapping,
				token_mapping: settings.token_mapping
			};

			await this.updateJobStatus(job.id, 'running', 30);

			const result = await apiService.executeTest(executionRequest);

			await this.updateJobStatus(job.id, 'running', 80);

			// Send result back to backend
			const resultResponse = await axios.post(`${this.backendUrl}/api/results`, {
				test_id: test.id!,
				agent_id: agent.id!,
				output: result.output,
				success: result.success,
				execution_time: result.execution_time,
				intermediate_steps: result.intermediate_steps,
				input_tokens: result.metrics.input_tokens,
				output_tokens: result.metrics.output_tokens,
				token_mapping_metadata: JSON.stringify({
					extraction_method: result.metrics.input_tokens || result.metrics.output_tokens ? 'external_api' : 'none',
					agent_type: 'external_api'
				}),
				metrics: result.metrics
			});

			const savedResult = resultResponse.data;

			await this.updateJobStatus(job.id, 'completed', 100, savedResult.id);
		} catch (error: any) {
			console.error(`Error executing job ${job.id}:`, error.message);
			
			await this.updateJobStatus(job.id, 'failed', 0, undefined, error.message);
		}
	}

	/**
	 * Update job status in the backend
	 */
	private async updateJobStatus(
		jobId: string, 
		status: 'running' | 'completed' | 'failed', 
		progress: number,
		resultId?: number,
		error?: string
	): Promise<void> {
		try {
			const updateData: any = {
				status,
				progress
			};

			if (resultId) {
				updateData.result_id = resultId;
			}

			if (error) {
				updateData.error = error;
			}

			await axios.put(`${this.backendUrl}/api/jobs/${jobId}`, updateData);
		} catch (error: any) {
			console.error(`Error updating job ${jobId} status:`, error.message);
		}
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const response = await axios.get(`${this.backendUrl}/api/health`);
			return response.status === 200;
		} catch (error) {
			return false;
		}
	}
}

// Export singleton instance
export const jobPoller = new JobPollerService();
