import { Agent, Test, TestResult } from '../../../backend/src/exports';

// Re-export types for use in components
export type { Agent, Test, TestResult };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Job status type (frontend-specific version)
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// Job interface
export interface Job {
    id: number;
    agent_id: number;
    test_id: number;
    status: JobStatus;
    result_id: number | null;
    created_at: string;
    updated_at: string;
    error?: string;
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
    }
};
