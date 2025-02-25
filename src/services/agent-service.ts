import axios, { AxiosInstance } from 'axios';
import { Agent, Test, TestResult } from '../db/queries';
import { agentServiceConfig } from '../config';

// Types that match the agent-service API
interface LLMConfig {
  provider: 'ollama';
  model: string;
  temperature: number;
  max_tokens: number;
  base_url: string;
}

interface AgentServiceConfig {
  role: string;
  goal: string;
  backstory: string;
  allow_delegation: boolean;
  allow_code_execution: boolean;
  memory: boolean;
  verbose: boolean;
  tools: string[];
  llm_config: LLMConfig;
}

interface CrewConfig {
  process: 'sequential' | 'hierarchical';
  async_execution: boolean;
  max_retries: number;
}

interface TestExecutionRequest {
  agent_configs: AgentServiceConfig[];
  crew_config: CrewConfig;
  test_input: string;
}

interface IntermediateStep {
  timestamp: string;
  agent_id: number;
  action: string;
  output: string;
}

interface Metrics {
  token_usage: number;
  model_calls: number;
  tool_calls: number;
}

interface TestExecutionResponse {
  agent_id: number;
  test_id: number;
  output: string;
  success: boolean;
  execution_time: number;
  intermediate_steps: IntermediateStep[];
  metrics: Metrics;
}

export class AgentService {
  private client: AxiosInstance;
  
  constructor(baseURL = agentServiceConfig.url, timeout = agentServiceConfig.timeout) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if the agent service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.error('Agent service health check failed:', error);
      return false;
    }
  }

  /**
   * Convert backend agent to agent service config
   */
  private convertAgentToConfig(agent: Agent): AgentServiceConfig {
    // Parse the settings JSON string to an object
    const settings = JSON.parse(agent.settings);
    
    return {
      role: settings.role || 'AI Assistant',
      goal: settings.goal || 'Help the user with their tasks',
      backstory: settings.backstory || 'I am an AI assistant',
      allow_delegation: settings.allow_delegation || false,
      allow_code_execution: settings.allow_code_execution || false,
      memory: settings.memory || false,
      verbose: settings.verbose || true,
      tools: settings.tools || [],
      llm_config: {
        provider: 'ollama',
        model: settings.model || 'llama2',
        temperature: settings.temperature || 0.7,
        max_tokens: settings.max_tokens || 1000,
        base_url: settings.base_url || 'http://localhost:11434',
      },
    };
  }

  /**
   * Execute a test using the agent service
   */
  async executeTest(agent: Agent, test: Test): Promise<TestResult> {
    try {
      // Convert agent to agent service config
      const agentConfig = this.convertAgentToConfig(agent);
      
      // Create the request payload
      const payload: TestExecutionRequest = {
        agent_configs: [agentConfig],
        crew_config: {
          process: 'sequential',
          async_execution: true,
          max_retries: 3,
        },
        test_input: test.input,
      };
      
      // Call the agent service
      const response = await this.client.post<TestExecutionResponse>('/execute-test', payload);
      
      // Convert the response to a TestResult
      return {
        agent_id: agent.id!,
        test_id: test.id!,
        output: response.data.output,
        intermediate_steps: JSON.stringify(response.data.intermediate_steps),
        success: response.data.success,
        execution_time: response.data.execution_time,
      };
    } catch (error) {
      console.error('Error executing test:', error);
      throw new Error(`Failed to execute test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance
export const agentService = new AgentService(); 