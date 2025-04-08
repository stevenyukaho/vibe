import { Agent, Test, TestResult } from '../types';
import { AgentService } from './agent-service';
import { ExternalAPIService } from './external-api-service';
import { BaseAgentSettings, isCrewAISettings, isExternalAPISettings } from './agent-types';

// Singleton instances
const crewAIService = new AgentService();
const externalAPIService = new ExternalAPIService();

/**
 * Factory to select the appropriate agent service based on agent type
 */
export class AgentServiceFactory {
  /**
   * Get the appropriate service for the agent
   */
  static getService(agent: Agent): AgentService | ExternalAPIService {
    try {
      const settings = JSON.parse(agent.settings) as BaseAgentSettings;
      
      // Default to CrewAI if no type specified
      if (!settings.type) {
        return crewAIService;
      }
      
      if (isExternalAPISettings(settings)) {
        return externalAPIService;
      }
      
      if (isCrewAISettings(settings)) {
        return crewAIService;
      }
      
      // Default fallback
      console.warn(`Unknown agent type: ${settings.type}, using CrewAI service`);
      return crewAIService;
    } catch (error: any) {
      console.error('Error parsing agent settings:', error);
      return crewAIService;
    }
  }
  
  /**
   * Execute a test with the appropriate service
   */
  static async executeTest(agent: Agent, test: Test): Promise<TestResult> {
    const service = this.getService(agent);
    return service.executeTest(agent, test);
  }
}

// Export a convenient function for test execution
export async function executeTest(agent: Agent, test: Test): Promise<TestResult> {
  return AgentServiceFactory.executeTest(agent, test);
}
