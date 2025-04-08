import axios from 'axios';
import { Agent, Test, TestResult } from '../types';
import { ExternalAPISettings, isExternalAPISettings } from './agent-types';

/**
 * Service for executing tests using external APIs
 */
export class ExternalAPIService {
  /**
   * Execute a test using an external API
   */
  async executeTest(agent: Agent, test: Test): Promise<TestResult> {
    try {
      // Parse agent settings
      const settings = JSON.parse(agent.settings);
      
      // Verify this is an external API agent
      if (!isExternalAPISettings(settings)) {
        throw new Error('Invalid agent type: Expected external_api');
      }
      
      // Start timing execution
      const startTime = Date.now();
      
      // Format request using the template if provided
      const requestPayload = settings.request_template 
        ? this.formatRequest(test.input, settings) 
        : { input: test.input };

      const headers = {
        'Content-Type': 'application/json',
        ...settings.headers,
        ...(settings.api_key ? { 'Authorization': `Bearer ${settings.api_key}` } : {})
      };

      const response = await axios.post(
        settings.api_endpoint,
        requestPayload,
        { headers }
      );
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Map response to result format
      const { output, steps, success } = this.processResponse(
        response.data,
        test,
        settings
      );
      
      if (!agent.id || !test.id) {
        throw new Error('Agent ID or Test ID is undefined');
      }
      
      // Return formatted test result
      return {
        agent_id: agent.id,
        test_id: test.id,
        output,
        intermediate_steps: steps,
        success,
        execution_time: executionTime,
        created_at: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error executing external API test:', error);
      throw error;
    }
  }
  
  /**
   * Format the request payload using the template
   */
  private formatRequest(input: string, settings: ExternalAPISettings): any {
    if (!settings.request_template) {
      return { input };
    }
    
    try {
      // Replace input placeholder in template
      const template = settings.request_template.replace(/\{\{input\}\}/g, input);
      return JSON.parse(template);
    } catch (error: any) {
      console.error('Error formatting request:', error);
      return { input };
    }
  }
  
  /**
   * Process the API response and convert to TestResult format
   */
  private processResponse(
    responseData: any, 
    test: Test,
    settings: ExternalAPISettings
  ): { output: string, steps: string, success: boolean } {
    // Default extraction - assume direct output
    let output = '';
    let steps = '[]';
    let success = false;
    
    try {
      if (settings.response_mapping) {
        // Parse response mapping if provided
        const mapping = JSON.parse(settings.response_mapping);
        
        // Extract output using path
        output = mapping.output ? this.extractByPath(responseData, mapping.output) : 
                 (typeof responseData === 'string' ? responseData : JSON.stringify(responseData));
        
        // Extract intermediate steps
        steps = mapping.intermediate_steps ? 
                JSON.stringify(this.extractByPath(responseData, mapping.intermediate_steps, [])) :
                '[]';
                
        // Determine success based on expected output
        if (test.expected_output) {
          success = output.trim() === test.expected_output.trim();
        }
      } else {
        // Default extraction - always stringify the response data
        output = JSON.stringify(responseData);
        
        if (test.expected_output) {
          success = output.trim() === test.expected_output.trim();
        }
      }
    } catch (error: any) {
      console.error('Error processing response:', error);
      output = `Error processing response: ${error.message}`;
      steps = '[]';
      success = false;
    }
    
    return { output, steps, success };
  }
  
  /**
   * Extract a value from an object using dot notation path
   */
  private extractByPath(obj: any, path: string, defaultValue: any = ''): any {
    if (!path) return defaultValue;
    
    try {
      const parts = path.split('.');
      let current = obj;
      
      for (const part of parts) {
        if (current === null || current === undefined) {
          return defaultValue;
        }
        current = current[part];
      }
      
      return current !== undefined ? current : defaultValue;
    } catch (error: any) {
      console.error('Error extracting path:', path, error);
      return defaultValue;
    }
  }
}

// Export a singleton instance
export const externalApiService = new ExternalAPIService();
