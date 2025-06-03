import axios from 'axios';
import { agentServiceConfig } from '../config';

/**
 * Service for communicating with the CrewAI agent service
 */
export class AgentService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = agentServiceConfig.url;
    }

    /**
     * Check if the agent service is healthy and available
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/health`, {
                timeout: 5000 // 5 second timeout
            });
            return response.status === 200;
        } catch (error) {
            console.error('Agent service health check failed:', error);
            return false;
        }
    }

    /**
     * Execute a test using the CrewAI agent service
     */
    async executeTest(agent: any, test: any): Promise<any> {
        try {
            const response = await axios.post(`${this.baseUrl}/execute`, {
                agent_settings: agent.settings,
                test_input: test.input,
                test_id: test.id,
                agent_id: agent.id
            }, {
                timeout: 300000 // 5 minute timeout for test execution
            });

            return response.data;
        } catch (error: any) {
            console.error('Error executing test via agent service:', error);
            throw new Error(`Agent service execution failed: ${error.message}`);
        }
    }
}

// Export singleton instance
export const agentService = new AgentService(); 