import axios from 'axios';
import { ExternalAPIService } from '../external-api-service';
import { Agent, Test } from '../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ExternalAPIService', () => {
  let service: ExternalAPIService;
  let mockAgent: Agent;
  let mockTest: Test;

  beforeEach(() => {
    service = new ExternalAPIService();
    
    // Mock test
    mockTest = {
      id: 1,
      name: 'Test API call',
      input: 'Hello, API!',
      expected_output: 'Hello, User!',
      created_at: new Date().toISOString()
    };
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('executeTest', () => {
    it('should execute test with default request format', async () => {
      // Mock agent with minimal settings
      mockAgent = {
        id: 1,
        name: 'External API Agent',
        version: '1.0',
        prompt: '',
        settings: JSON.stringify({
          type: 'external_api',
          api_endpoint: 'https://api.example.com/chat',
          api_key: 'test-api-key'
        }),
        created_at: new Date().toISOString()
      };
      
      // Mock API response
      mockedAxios.post.mockResolvedValueOnce({
        data: { output: 'Hello, User!' }
      });
      
      // Execute test
      const result = await service.executeTest(mockAgent, mockTest);
      
      // Verify axios was called correctly
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.example.com/chat', 
        { input: 'Hello, API!' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
      
      // Verify result format
      expect(result).toEqual(expect.objectContaining({
        agent_id: 1,
        test_id: 1,
        output: '{"output":"Hello, User!"}',
        success: false,
        intermediate_steps: '[]'
      }));
    });
    
    it('should use request template if provided', async () => {
      // Mock agent with request template
      mockAgent = {
        id: 1,
        name: 'External API Agent',
        version: '1.0',
        prompt: '',
        settings: JSON.stringify({
          type: 'external_api',
          api_endpoint: 'https://api.example.com/chat',
          api_key: 'test-api-key',
          request_template: '{"messages": [{"role": "user", "content": "{{input}}"}]}'
        }),
        created_at: new Date().toISOString()
      };
      
      // Mock API response
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: 'Hello, User!' }
      });
      
      // Execute test
      await service.executeTest(mockAgent, mockTest);
      
      // Verify request was formatted correctly
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.example.com/chat',
        { messages: [{ role: 'user', content: 'Hello, API!' }] },
        expect.any(Object)
      );
    });
    
    it('should use response mapping if provided', async () => {
      // Mock agent with response mapping
      mockAgent = {
        id: 1,
        name: 'External API Agent',
        version: '1.0',
        prompt: '',
        settings: JSON.stringify({
          type: 'external_api',
          api_endpoint: 'https://api.example.com/chat',
          api_key: 'test-api-key',
          response_mapping: '{"output": "choices.0.message.content", "intermediate_steps": "usage"}'
        }),
        created_at: new Date().toISOString()
      };
      
      // Mock API response similar to OpenAI
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: 'Hello, User!'
              }
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20
          }
        }
      });
      
      // Execute test
      const result = await service.executeTest(mockAgent, mockTest);
      
      // Verify output was mapped correctly
      expect(result.output).toBe('Hello, User!');
      expect(result.intermediate_steps).toBe('{"prompt_tokens":10,"completion_tokens":20}');
      expect(result.success).toBe(true);
    });
    
    it('should handle errors gracefully', async () => {
      // Mock agent
      mockAgent = {
        id: 1,
        name: 'External API Agent',
        version: '1.0',
        prompt: '',
        settings: JSON.stringify({
          type: 'external_api',
          api_endpoint: 'https://api.example.com/chat'
        }),
        created_at: new Date().toISOString()
      };
      
      // Mock API error
      mockedAxios.post.mockRejectedValueOnce(new Error('API not available'));
      
      // Execute test should throw
      await expect(service.executeTest(mockAgent, mockTest)).rejects.toThrow();
    });
  });
});
