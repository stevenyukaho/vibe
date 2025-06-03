import { Agent, Test, TestResult } from '../../../backend/src/exports';

// Re-export types for use in components
export type { Agent, Test, TestResult };

export interface LLMConfig {
    id: number;
    name: string;
    provider: string;
    config: string;
    priority: number;
    created_at?: string;
    updated_at?: string;
}

export interface LLMRequestOptions {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
    stop?: string[];
}

export interface LLMResponse {
    text: string;
    provider: string;
    model: string;
    config_id: number;
    error?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Job status type (frontend-specific version)
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// Job interface
export interface Job {
    id: number;
    agent_id: number;
    test_id: number;
    status: JobStatus;
    progress: number;
    result_id: number | null;
    created_at: string;
    updated_at: string;
    error?: string;
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
    total_execution_time?: number;
    started_at: string;
    completed_at?: string;
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
    // Agents
    async getAgents(): Promise<Agent[]> {
        const response = await fetch(`${API_URL}/api/agents`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch agents');
        }
        
        return response.json();
    },

    async createAgent(agent: Omit<Agent, 'id' | 'created_at'>): Promise<Agent> {
        const response = await fetch(`${API_URL}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agent),
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
            body: JSON.stringify(agent),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update agent');
        }
        
        return response.json();
    },

    async deleteAgent(id: number): Promise<void> {
        const response = await fetch(`${API_URL}/api/agents/${id}`, {
            method: 'DELETE',
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
            body: JSON.stringify(test),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create test');
        }
        
        return response.json();
    },

    async updateTest(id: number, test: Partial<Test>): Promise<Test> {
        const response = await fetch(`${API_URL}/api/tests/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(test),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update test');
        }
        
        return response.json();
    },

    async deleteTest(id: number): Promise<void> {
        const response = await fetch(`${API_URL}/api/tests/${id}`, {
            method: 'DELETE',
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
    async getResults(filters?: { agent_id?: number; test_id?: number }): Promise<TestResult[]> {
        const params = new URLSearchParams();
        if (filters?.agent_id) params.append('agent_id', filters.agent_id.toString());
        if (filters?.test_id) params.append('test_id', filters.test_id.toString());
        
        const response = await fetch(`${API_URL}/api/results?${params}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch results');
        }
        
        return response.json();
    },

    async createResult(result: Omit<TestResult, 'id' | 'created_at'>): Promise<TestResult> {
        const response = await fetch(`${API_URL}/api/results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create result');
        }
        
        return response.json();
    },

    // Execute a test with a specific agent
    async executeTest(agent_id: number, test_id: number): Promise<TestResult> {
        const response = await fetch(`${API_URL}/api/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id, test_id }),
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

    async getTestsInSuite(suite_id: number): Promise<Test[]> {
        const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/tests`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch tests in suite');
        }
        return response.json();
    },

    async executeSuite(suite_id: number, agent_id: number): Promise<{ suite_run_id: number }> {
        const response = await fetch(`${API_URL}/api/execute-suite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suite_id, agent_id }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to execute suite');
        }
        return response.json();
    },

    // Suite Runs
    async getSuiteRuns(): Promise<SuiteRun[]> {
        const response = await fetch(`${API_URL}/api/suite-runs`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch suite runs');
        }
        return response.json();
    },

    async getSuiteRunJobs(suite_run_id: number): Promise<Job[]> {
        const response = await fetch(`${API_URL}/api/suite-runs/${suite_run_id}/jobs`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch suite run jobs');
        }
        return response.json();
    },

    // Single Suite Run
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
            method: 'DELETE',
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
    async getJobs(): Promise<Job[]> {
        const response = await fetch(`${API_URL}/api/jobs`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch jobs');
        }
        
        return response.json();
    },

    async createJob(agent_id: number, test_id: number): Promise<Job> {
        const response = await fetch(`${API_URL}/api/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id, test_id }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create job');
        }
        
        return response.json();
    },

    async getJobStatus(id: number): Promise<Job> {
        const response = await fetch(`${API_URL}/api/jobs/${id}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch job status');
        }
        
        return response.json();
    },
    
    async cancelJob(id: number): Promise<void> {
        const response = await fetch(`${API_URL}/api/jobs/${id}/cancel`, {
            method: 'POST',
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
    
    async deleteJob(id: number): Promise<void> {
        const response = await fetch(`${API_URL}/api/jobs/${id}`, {
            method: 'DELETE',
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
            body: JSON.stringify(suite),
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
            body: JSON.stringify(suite),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update test suite');
        }
        return response.json();
    },

    async deleteTestSuite(id: number): Promise<void> {
        const response = await fetch(`${API_URL}/api/test-suites/${id}`, {
            method: 'DELETE',
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
            body: JSON.stringify({ test_id }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add test to suite');
        }
    },

    async removeTestFromSuite(suite_id: number, test_id: number): Promise<void> {
        const response = await fetch(`${API_URL}/api/test-suites/${suite_id}/tests/${test_id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove test from suite');
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
            body: JSON.stringify(config),
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
            body: JSON.stringify(config),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update LLM config');
        }
        
        return response.json();
    },

    async deleteLLMConfig(id: number): Promise<void> {
        const response = await fetch(`${API_URL}/api/llm-configs/${id}`, {
            method: 'DELETE',
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
            body: JSON.stringify(options),
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
            body: JSON.stringify(options),
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
    }
};
