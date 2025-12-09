import type { Agent, Test, TestResult } from '@ibm-vibe/types';
import type { PaginatedResponse, StatsResponse, LLMRequestOptions, LLMResponse } from '@ibm-vibe/types';
import type { Conversation, ConversationMessage, ExecutionSession, SessionMessage, ConversationTurnTarget } from '@ibm-vibe/types';
import { frontendConfig } from './runtimeConfig';

// Re-export types for use in components
export type { Agent, Test, TestResult };
export type { Conversation, ConversationMessage, ExecutionSession, SessionMessage, ConversationTurnTarget };

export interface LLMConfig {
	id: number;
	name: string;
	provider: string;
	config: string;
	priority: number;
	created_at?: string;
	updated_at?: string;
}

const API_URL = frontendConfig.apiUrl;

// Job status type (frontend-specific version)
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// Job interface
export interface Job {
	id: string; // UUID
	agent_id: number;
	test_id?: number; // Legacy field
	conversation_id?: number; // New field for conversations
	status: JobStatus;
	progress: number;
	result_id?: number | null; // Legacy field
	session_id?: number; // New field for execution sessions
	created_at: string;
	updated_at: string;
	error?: string;
	suite_run_id?: number;
	job_type?: string;
	claimed_by?: string;
	claimed_at?: string;
}

// Test Suite and Suite Run interfaces
export interface TestSuite {
	id: number;
	name: string;
	description?: string;
	tags?: string;
	created_at?: string;
	updated_at?: string;
	test_count?: number;
}

export interface SuiteRun {
	id: number;
	suite_id: number;
	agent_id: number;
	agent_name?: string;
	status: JobStatus;
	progress: number;
	total_tests: number;
	completed_tests: number;
	successful_tests: number;
	failed_tests: number;
	average_execution_time?: number;
	total_input_tokens?: number;
	total_output_tokens?: number;
	started_at: string;
	completed_at?: string;
	avg_similarity_score?: number;
}

export interface SuiteEntry {
	id: number;
	parent_suite_id: number;
	sequence: number;
	test_id?: number;
	child_suite_id?: number;
	agent_id_override?: number;
}

export const api = {
	async getStats(): Promise<StatsResponse> {
		const response = await fetch(`${API_URL}/api/stats`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch stats');
		}
		return response.json();
	},

	// Agent communication configs: Request Templates
	async getAgentRequestTemplates(agentId: number): Promise<Array<{ id: number; name: string; body: string; is_default?: number }>> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/request-templates`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch request templates');
		}
		return response.json();
	},

	async createAgentRequestTemplate(agentId: number, payload: { name: string; description?: string; engine?: string; content_type?: string; body: string; tags?: string; is_default?: boolean }): Promise<any> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/request-templates`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create request template');
		}
		return response.json();
	},

	async updateAgentRequestTemplate(agentId: number, templateId: number, updates: Partial<{ name: string; description?: string; engine?: string; content_type?: string; body: string; tags?: string; is_default?: boolean }>): Promise<any> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/request-templates/${templateId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update request template');
		}
		return response.json();
	},

	async deleteAgentRequestTemplate(agentId: number, templateId: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/request-templates/${templateId}`, { method: 'DELETE' });
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete request template');
		}
	},

	async setDefaultAgentRequestTemplate(agentId: number, templateId: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/request-templates/${templateId}/default`, { method: 'POST' });
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to set default request template');
		}
	},

	// Agent communication configs: Response Maps
	async getAgentResponseMaps(agentId: number): Promise<Array<{ id: number; name: string; spec: string; is_default?: number }>> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/response-maps`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch response maps');
		}
		return response.json();
	},

	async createAgentResponseMap(agentId: number, payload: { name: string; description?: string; spec: string; tags?: string; is_default?: boolean }): Promise<any> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/response-maps`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create response map');
		}
		return response.json();
	},

	async updateAgentResponseMap(agentId: number, mapId: number, updates: Partial<{ name: string; description?: string; spec: string; tags?: string; is_default?: boolean }>): Promise<any> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/response-maps/${mapId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update response map');
		}
		return response.json();
	},

	async deleteAgentResponseMap(agentId: number, mapId: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/response-maps/${mapId}`, { method: 'DELETE' });
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete response map');
		}
	},

	async setDefaultAgentResponseMap(agentId: number, mapId: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/agents/${agentId}/response-maps/${mapId}/default`, { method: 'POST' });
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to set default response map');
		}
	},

	// Agents
	async getAgents(): Promise<Agent[]> {
		const response = await fetch(`${API_URL}/api/agents`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch agents');
		}

		return response.json();
	},

	async getAgentById(id: number): Promise<Agent> {
		const response = await fetch(`${API_URL}/api/agents/${id}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch agent');
		}

		return response.json();
	},

	async createAgent(agent: Omit<Agent, 'id' | 'created_at'>): Promise<Agent> {
		const response = await fetch(`${API_URL}/api/agents`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(agent)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create agent');
		}

		return response.json();
	},

	async updateAgent(id: number, agent: Partial<Agent>): Promise<Agent> {
		const response = await fetch(`${API_URL}/api/agents/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(agent)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update agent');
		}

		return response.json();
	},

	async deleteAgent(id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/agents/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			let errorMessage = `Failed to delete agent (Status: ${response.status})`;

			// Try to parse response as JSON, but don't fail if it's not JSON
			const contentType = response.headers.get('content-type');
			if (contentType && contentType.includes('application/json')) {
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorMessage;
				} catch {
					// Ignore JSON parsing errors
				}
			}

			throw new Error(errorMessage);
		}
	},

	// Tests
	async getTests(): Promise<Test[]> {
		const response = await fetch(`${API_URL}/api/tests`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch tests');
		}

		return response.json();
	},

	async createTest(test: Omit<Test, 'id' | 'created_at' | 'updated_at'>): Promise<Test> {
		const response = await fetch(`${API_URL}/api/tests`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(test)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create test');
		}

		return response.json();
	},

	async getTestById(id: number): Promise<Test> {
		const response = await fetch(`${API_URL}/api/tests/${id}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch test');
		}

		return response.json();
	},

	async updateTest(id: number, test: Partial<Test>): Promise<Test> {
		const response = await fetch(`${API_URL}/api/tests/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(test)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update test');
		}

		return response.json();
	},

	async deleteTest(id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/tests/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			let errorMessage = `Failed to delete test (Status: ${response.status})`;

			// Try to parse response as JSON, but don't fail if it's not JSON
			const contentType = response.headers.get('content-type');
			if (contentType && contentType.includes('application/json')) {
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorMessage;
				} catch {
					// Ignore JSON parsing errors
				}
			}

			throw new Error(errorMessage);
		}
	},

	// Results
	async getResults(filters?: { agent_id?: number; test_id?: number; limit?: number; offset?: number }): Promise<TestResult[]> {
		const params = new URLSearchParams();
		if (filters?.agent_id) params.append('agent_id', filters.agent_id.toString());
		if (filters?.test_id) params.append('test_id', filters.test_id.toString());
		if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
		if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

		const response = await fetch(`${API_URL}/api/results?${params}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch results');
		}

		const result = await response.json();

		return Array.isArray(result) ? result : result.data;
	},

	async getResultsWithCount(filters?: { agent_id?: number; test_id?: number; limit?: number; offset?: number }): Promise<PaginatedResponse<TestResult>> {
		const params = new URLSearchParams();
		if (filters?.agent_id) {
			params.append('agent_id', filters.agent_id.toString());
		}
		if (filters?.test_id) {
			params.append('test_id', filters.test_id.toString());
		}
		if (filters?.limit !== undefined) {
			params.append('limit', filters.limit.toString());
		}
		if (filters?.offset !== undefined) {
			params.append('offset', filters.offset.toString());
		}
		const response = await fetch(`${API_URL}/api/results?${params}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch results');
		}

		const result = await response.json();

		if (Array.isArray(result)) {
			return { data: result, total: result.length };
		}
		return result;
	},

	async getResultById(id: number): Promise<TestResult> {
		const response = await fetch(`${API_URL}/api/results/${id}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch result');
		}

		return response.json();
	},

	async createResult(result: Omit<TestResult, 'id' | 'created_at'>): Promise<TestResult> {
		const response = await fetch(`${API_URL}/api/results`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(result)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create result');
		}

		return response.json();
	},

	async scoreResult(resultId: number, llmConfigId?: number): Promise<TestResult> {
		const response = await fetch(`${API_URL}/api/results/${resultId}/score`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ llm_config_id: llmConfigId })
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to score result');
		}

		return response.json();
	},

	// Execute a test with a specific agent
	async executeTest(agent_id: number, test_id: number): Promise<TestResult> {
		const response = await fetch(`${API_URL}/api/execute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id, test_id })
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to execute test');
		}

		return response.json();
	},

	// Test Suites
	async getTestSuites(): Promise<(TestSuite & { test_count: number })[]> {
		const response = await fetch(`${API_URL}/api/test-suites`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch test suites');
		}
		return response.json();
	},


	async executeSuite(suite_id: number, agent_id: number): Promise<{ suite_run_id: number }> {
		const response = await fetch(`${API_URL}/api/execute-suite`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ suite_id, agent_id })
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to execute suite');
		}
		return response.json();
	},

	// Suite runs
	async getSuiteRuns(filters?: { limit?: number; offset?: number; suite_id?: number; agent_id?: number; status?: JobStatus; after?: Date; before?: Date }): Promise<SuiteRun[]> {
		const params = new URLSearchParams();
		if (filters?.limit !== undefined) {
			params.append('limit', filters.limit.toString());
		}
		if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());
		if (filters?.suite_id !== undefined) {
			params.append('suite_id', String(filters.suite_id));
		}
		if (filters?.agent_id !== undefined) {
			params.append('agent_id', String(filters.agent_id));
		}
		if (filters?.status !== undefined) {
			params.append('status', String(filters.status));
		}
		if (filters?.after !== undefined) {
			params.append('after', filters.after.toISOString());
		}
		if (filters?.before !== undefined) {
			params.append('before', filters.before.toISOString());
		}

		const response = await fetch(`${API_URL}/api/suite-runs?${params}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch suite runs');
		}

		const result = await response.json();

		return Array.isArray(result) ? result : result.data;
	},

	async getSuiteRunsWithCount(filters?: { limit?: number; offset?: number; suite_id?: number; agent_id?: number; status?: JobStatus; after?: Date; before?: Date }): Promise<PaginatedResponse<SuiteRun>> {
		const params = new URLSearchParams();
		if (filters?.limit !== undefined) {
			params.append('limit', filters.limit.toString());
		}
		if (filters?.offset !== undefined) {
			params.append('offset', filters.offset.toString());
		}
		if (filters?.suite_id !== undefined) {
			params.append('suite_id', String(filters.suite_id));
		}
		if (filters?.agent_id !== undefined) {
			params.append('agent_id', String(filters.agent_id));
		}
		if (filters?.status !== undefined) {
			params.append('status', String(filters.status));
		}
		if (filters?.after !== undefined) {
			params.append('after', filters.after.toISOString());
		}
        if (filters?.before !== undefined) {
			params.append('before', filters.before.toISOString());
		}

		const response = await fetch(`${API_URL}/api/suite-runs?${params}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch suite runs');
		}

		const result = await response.json();

		if (Array.isArray(result)) {
			return { data: result, total: result.length };
		}
		return result;
	},

	async getSuiteRunJobs(suite_run_id: number): Promise<Job[]> {
		const response = await fetch(`${API_URL}/api/suite-runs/${suite_run_id}/jobs`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch suite run jobs');
		}
		return response.json();
	},

	// Single suite run
	async getSuiteRun(id: number): Promise<SuiteRun> {
		const response = await fetch(`${API_URL}/api/suite-runs/${id}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch suite run');
		}
		return response.json();
	},

	async deleteSuiteRun(id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/suite-runs/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			let errorMessage = 'Failed to delete suite run';
			try {
				const error = await response.json();
				errorMessage = error.error || errorMessage;
			} catch {
				// Ignore JSON parsing errors
			}
			throw new Error(errorMessage);
		}
	},

	async rerunSuiteRun(id: number): Promise<{ suite_run_id: number }> {
		const suiteRun = await this.getSuiteRun(id);
		return this.executeSuite(suiteRun.suite_id, suiteRun.agent_id);
	},

	// Jobs
	async getJobs(filters?: { limit?: number; offset?: number }): Promise<Job[]> {
		const params = new URLSearchParams();
		if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
		if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

		const response = await fetch(`${API_URL}/api/jobs?${params}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch jobs');
		}

		const result = await response.json();

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

		const response = await fetch(`${API_URL}/api/jobs?${params}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch jobs');
		}

		const result = await response.json();

		if (Array.isArray(result)) {
			return { data: result, total: result.length };
		}
		return result;
	},

	async createJob(agent_id: number, test_id: number): Promise<Job> {
		const response = await fetch(`${API_URL}/api/jobs`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id, test_id })
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create job');
		}

		return response.json();
	},

	async getJobStatus(id: string): Promise<Job> {
		const response = await fetch(`${API_URL}/api/jobs/${id}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch job status');
		}

		return response.json();
	},

	async cancelJob(id: string): Promise<void> {
		const response = await fetch(`${API_URL}/api/jobs/${id}/cancel`, {
			method: 'POST'
		});

		if (!response.ok) {
			let errorMessage = 'Failed to cancel job';
			try {
				const error = await response.json();
				errorMessage = error.error || errorMessage;
			} catch {
				// Ignore JSON parsing errors
			}
			throw new Error(errorMessage);
		}
	},

	async deleteJob(id: string): Promise<void> {
		const response = await fetch(`${API_URL}/api/jobs/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			let errorMessage = 'Failed to delete job';
			try {
				const error = await response.json();
				errorMessage = error.error || errorMessage;
			} catch {
				// Ignore JSON parsing errors
			}
			throw new Error(errorMessage);
		}
	},

	// Suite management
	async createTestSuite(suite: Omit<TestSuite, 'id' | 'created_at' | 'updated_at'>): Promise<TestSuite> {
		const response = await fetch(`${API_URL}/api/test-suites`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(suite)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create test suite');
		}
		return response.json();
	},

	async updateTestSuite(id: number, suite: Partial<TestSuite>): Promise<TestSuite> {
		const response = await fetch(`${API_URL}/api/test-suites/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(suite)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update test suite');
		}
		return response.json();
	},

	async deleteTestSuite(id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/test-suites/${id}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete test suite');
		}
	},

	async addTestToSuite(suite_id: number, test_id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/tests`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ test_id })
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to add test to suite');
		}
	},

	// LLM Configs
	async getLLMConfigs(): Promise<LLMConfig[]> {
		const response = await fetch(`${API_URL}/api/llm-configs`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch LLM configs');
		}

		return response.json();
	},

	async getLLMConfigById(id: number): Promise<LLMConfig> {
		const response = await fetch(`${API_URL}/api/llm-configs/${id}`);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch LLM config');
		}

		return response.json();
	},

	async createLLMConfig(config: Omit<LLMConfig, 'id' | 'created_at' | 'updated_at'>): Promise<LLMConfig> {
		const response = await fetch(`${API_URL}/api/llm-configs`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create LLM config');
		}

		return response.json();
	},

	async updateLLMConfig(id: number, config: Partial<LLMConfig>): Promise<LLMConfig> {
		const response = await fetch(`${API_URL}/api/llm-configs/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update LLM config');
		}

		return response.json();
	},

	async deleteLLMConfig(id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/llm-configs/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			let errorMessage = `Failed to delete LLM config (Status: ${response.status})`;

			// Try to parse response as JSON, but don't fail if it's not JSON
			const contentType = response.headers.get('content-type');
			if (contentType && contentType.includes('application/json')) {
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorMessage;
				} catch {
					// Ignore JSON parsing errors
				}
			}

			throw new Error(errorMessage);
		}
	},

	async callLLM(id: number, options: LLMRequestOptions): Promise<LLMResponse> {
		const response = await fetch(`${API_URL}/api/llm-configs/${id}/call`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(options)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to call LLM');
		}

		return response.json();
	},

	async callLLMWithFallback(options: LLMRequestOptions): Promise<LLMResponse> {
		const response = await fetch(`${API_URL}/api/llm-configs/call`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(options)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to call LLM with fallback');
		}

		return response.json();
	},

	// Suite Entries
	async getSuiteEntries(suite_id: number): Promise<SuiteEntry[]> {
		const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/entries`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch suite entries');
		}
		const data = await response.json() as SuiteEntry[];
		return data;
	},

	async addSuiteEntry(suite_id: number, entry: { sequence?: number; test_id?: number; child_suite_id?: number; agent_id_override?: number }): Promise<SuiteEntry> {
		const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/entries`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to add suite entry');
		}
		const data = await response.json() as SuiteEntry;
		return data;
	},

	async updateSuiteEntry(suite_id: number, entry_id: number, updates: { sequence?: number; agent_id_override?: number | null }): Promise<void> {
		const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/entries/${entry_id}`, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update suite entry');
		}
	},

	async deleteSuiteEntry(suite_id: number, entry_id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/entries/${entry_id}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete suite entry');
		}
	},

	async reorderSuiteEntries(suite_id: number, entry_orders: { entry_id: number; sequence: number }[]): Promise<{ success: boolean }> {
		const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/entries/reorder`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ entry_orders })
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to reorder suite entries');
		}
		const data = await response.json() as { success: boolean };
		return data;
	},

	// Conversations
	async getConversations(filters?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Conversation>> {
		const params = new URLSearchParams();
		if (filters?.limit !== undefined) {
			params.append('limit', filters.limit.toString());
		}
		if (filters?.offset !== undefined) {
			params.append('offset', filters.offset.toString());
		}

		const response = await fetch(`${API_URL}/api/conversations?${params}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch conversations');
		}
		return response.json();
	},

	async getConversationById(id: number): Promise<Conversation> {
		const response = await fetch(`${API_URL}/api/conversations/${id}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch conversation');
		}
		return response.json();
	},

	async createConversation(conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>): Promise<Conversation> {
		const response = await fetch(`${API_URL}/api/conversations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(conversation)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to create conversation');
		}
		return response.json();
	},

	async updateConversation(id: number, conversation: Partial<Conversation>): Promise<Conversation> {
		const response = await fetch(`${API_URL}/api/conversations/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(conversation)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update conversation');
		}
		return response.json();
	},

	async deleteConversation(id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/conversations/${id}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete conversation');
		}
	},

	async addMessageToConversation(conversationId: number, message: Omit<ConversationMessage, 'id' | 'conversation_id' | 'created_at'>): Promise<ConversationMessage> {
		const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(message)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to add message to conversation');
		}
		return response.json();
	},

	async updateConversationMessage(conversationId: number, messageId: number, updates: Partial<ConversationMessage>): Promise<ConversationMessage> {
		const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages/${messageId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to update conversation message');
		}
		return response.json();
	},

	async deleteConversationMessage(conversationId: number, sequence: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages/${sequence}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete conversation message');
		}
	},

	async reorderConversationMessages(conversationId: number, messages: { id: number; sequence: number }[]): Promise<void> {
		const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages/reorder`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages })
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to reorder conversation messages');
		}
	},

	// Execute a conversation with a specific agent
	async executeConversation(agent_id: number, conversation_id: number): Promise<{ job_id: string; message: string }> {
		const response = await fetch(`${API_URL}/api/execute/conversation`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id, conversation_id })
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to execute conversation');
		}
		return response.json();
	},

	// Execution Sessions
	async getExecutionSessions(filters?: { conversation_id?: number; agent_id?: number; limit?: number; offset?: number }): Promise<PaginatedResponse<ExecutionSession>> {
		const params = new URLSearchParams();
		if (filters?.conversation_id) {
			params.append('conversation_id', filters.conversation_id.toString());
		}
		if (filters?.agent_id) {
			params.append('agent_id', filters.agent_id.toString());
		}
		if (filters?.limit !== undefined) {
			params.append('limit', filters.limit.toString());
		}
		if (filters?.offset !== undefined) {
			params.append('offset', filters.offset.toString());
		}

		const response = await fetch(`${API_URL}/api/sessions?${params}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch execution sessions');
		}
		return response.json();
	},

	async getExecutionSessionById(id: number): Promise<ExecutionSession> {
		const response = await fetch(`${API_URL}/api/sessions/${id}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch execution session');
		}
		return response.json();
	},

	async getSessionTranscript(sessionId: number): Promise<SessionMessage[]> {
		const response = await fetch(`${API_URL}/api/sessions/${sessionId}/transcript`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch session transcript');
		}
		const data = await response.json();
		return data.messages;
	},

	async getSessionTranscriptWithSession(sessionId: number): Promise<{ session: ExecutionSession; messages: SessionMessage[] }> {
		const response = await fetch(`${API_URL}/api/sessions/${sessionId}/transcript`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch session transcript');
		}
		const data = await response.json();
		return {
			session: data.session,
			messages: data.messages || []
		};
	},

	async regenerateSimilarityScore(messageId: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/session-messages/${messageId}/regenerate-score`, {
			method: 'POST'
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to regenerate similarity score');
		}
	},

	// Conversation turn targets
	async getConversationTurnTargets(conversationId: number): Promise<ConversationTurnTarget[]> {
		const response = await fetch(`${API_URL}/api/conversation-turn-targets/conversation/${conversationId}`);
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to fetch turn targets');
		}
		return response.json();
	},

	async saveConversationTurnTarget(target: Omit<ConversationTurnTarget, 'id' | 'created_at' | 'updated_at'>): Promise<ConversationTurnTarget> {
		const response = await fetch(`${API_URL}/api/conversation-turn-targets`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(target)
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to save turn target');
		}
		return response.json();
	},

	async deleteConversationTurnTarget(id: number): Promise<void> {
		const response = await fetch(`${API_URL}/api/conversation-turn-targets/${id}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Failed to delete turn target');
		}
	}
};
