import { Agent, Test, TestResult } from '../../../backend/src/db/queries';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = {
    // Agents
    async getAgents(): Promise<Agent[]> {
        const response = await fetch(`${API_URL}/api/agents`);
        return response.json();
    },

    async createAgent(agent: Omit<Agent, 'id' | 'created_at'>): Promise<Agent> {
        const response = await fetch(`${API_URL}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agent),
        });
        return response.json();
    },

    // Tests
    async getTests(): Promise<Test[]> {
        const response = await fetch(`${API_URL}/api/tests`);
        return response.json();
    },

    async createTest(test: Omit<Test, 'id' | 'created_at' | 'updated_at'>): Promise<Test> {
        const response = await fetch(`${API_URL}/api/tests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(test),
        });
        return response.json();
    },

    async updateTest(id: number, test: Partial<Test>): Promise<Test> {
        const response = await fetch(`${API_URL}/api/tests/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(test),
        });
        return response.json();
    },

    // Results
    async getResults(filters?: { agent_id?: number; test_id?: number }): Promise<TestResult[]> {
        const params = new URLSearchParams();
        if (filters?.agent_id) params.append('agent_id', filters.agent_id.toString());
        if (filters?.test_id) params.append('test_id', filters.test_id.toString());
        
        const response = await fetch(`${API_URL}/api/results?${params}`);
        return response.json();
    },

    async createResult(result: Omit<TestResult, 'id' | 'created_at'>): Promise<TestResult> {
        const response = await fetch(`${API_URL}/api/results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
        });
        return response.json();
    },
};
