import type { Job, PaginatedResponse, TestResult } from './types';
import { API_URL, fetchJson } from './fetchJson';

export const jobsApi = {
	// Execute a test with a specific agent
	async executeTest(agent_id: number, test_id: number): Promise<TestResult> {
		return fetchJson<TestResult>(
			`${API_URL}/api/execute`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ agent_id, test_id })
			},
			'Failed to execute test'
		);
	},

	// Jobs
	async getJobs(filters?: { limit?: number; offset?: number }): Promise<Job[]> {
		const params = new URLSearchParams();
		if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
		if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

		const result = await fetchJson<Job[] | PaginatedResponse<Job>>(
			`${API_URL}/api/jobs?${params}`,
			undefined,
			'Failed to fetch jobs'
		);
		return Array.isArray(result) ? result : result.data;
	},

	async getJobsWithCount(filters?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Job>> {
		const params = new URLSearchParams();
		if (filters?.limit !== undefined) {
			params.append('limit', filters.limit.toString());
		}
		if (filters?.offset !== undefined) {
			params.append('offset', filters.offset.toString());
		}

		const result = await fetchJson<Job[] | PaginatedResponse<Job>>(
			`${API_URL}/api/jobs?${params}`,
			undefined,
			'Failed to fetch jobs'
		);

		if (Array.isArray(result)) {
			return { data: result, total: result.length };
		}
		return result;
	},

	async createJob(agent_id: number, test_id: number): Promise<Job> {
		return fetchJson<Job>(
			`${API_URL}/api/jobs`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ agent_id, test_id })
			},
			'Failed to create job'
		);
	},

	async getJobStatus(id: string): Promise<Job> {
		return fetchJson<Job>(`${API_URL}/api/jobs/${id}`, undefined, 'Failed to fetch job status');
	},

	async cancelJob(id: string): Promise<void> {
		await fetchJson<void>(`${API_URL}/api/jobs/${id}/cancel`, { method: 'POST' }, 'Failed to cancel job');
	},

	async deleteJob(id: string): Promise<void> {
		await fetchJson<void>(`${API_URL}/api/jobs/${id}`, { method: 'DELETE' }, 'Failed to delete job');
	}
};
