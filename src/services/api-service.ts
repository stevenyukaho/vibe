import axios, { AxiosRequestConfig } from 'axios';
import {
	TestExecutionRequest,
	TestExecutionResponse,
	IntermediateStep,
	ResponseMapping
} from '../types';
import { DEFAULT_TIMEOUT } from '../config';

/**
 * Service for executing tests via external APIs.
 * This service handles communication with external AI APIs, including request formatting,
 * response processing, and result validation. It supports template-based requests,
 * configurable response mapping, and various success criteria.
 */
export class ApiService {
	/**
	 * Executes a test using an external API.
	 * 
	 * @param request - The test execution request containing API configuration and test input
	 * @returns Promise<TestExecutionResponse> - The test execution result including output, success status, and metrics
	 * 
	 * @description
	 * This method:
	 * 1. Formats the request using templates if provided
	 * 2. Sets up headers including authentication
	 * 3. Makes the API call with configured timeout
	 * 4. Logs intermediate steps
	 * 5. Processes the response
	 * 6. Returns formatted results with execution metrics
	 * 
	 * The method includes comprehensive error handling and timing of the execution.
	 */
	async executeTest(request: TestExecutionRequest): Promise<TestExecutionResponse> {
		// Start timing execution
		const startTime = Date.now();

		try {
			// Format request using the template if provided
			const requestPayload = request.request_template
				? this.formatRequest(request.test_input, request.request_template)
				: { input: request.test_input };

			// Setup headers
			const headers = {
				'Content-Type': 'application/json',
				...request.headers,
				...(request.api_key ? { 'Authorization': `Bearer ${request.api_key}` } : {})
			};

			// Configure request
			const config: AxiosRequestConfig = {
				headers,
				timeout: DEFAULT_TIMEOUT
			};

			// Log the API call as an intermediate step
			const intermediateSteps: IntermediateStep[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'API Call Initiated',
					output: `Calling ${request.api_endpoint}`
				}
			];

			// Get HTTP method, default to POST
			const httpMethod = request.http_method || 'POST';

			let response;
			if (httpMethod === 'GET') {
				// For GET requests, append query parameters instead of body
				const url = new URL(request.api_endpoint);
				if (request.request_template) {
					const formattedRequest = this.formatRequest(request.test_input, request.request_template);
					Object.entries(formattedRequest).forEach(([key, value]) => {
						url.searchParams.append(key, String(value));
					});
				} else {
					url.searchParams.append('input', request.test_input);
				}
				
				response = await axios.get(url.toString(), config);
			} else {
				// For POST, PUT, PATCH, DELETE - use request body
				response = await axios({
					method: httpMethod.toLowerCase(),
					url: request.api_endpoint,
					data: requestPayload,
					...config
				});
			}

			// Log the API response
			intermediateSteps.push({
				timestamp: new Date().toISOString(),
				action: 'API Response Received',
				output: 'Response received from external API'
			});

			// End timing
			const executionTime = Date.now() - startTime;

			// Process the response
			const { output, steps, success } = this.processResponse(
				response.data,
				request,
				intermediateSteps
			);

			// Return formatted response
			return {
				test_id: request.test_id,
				output,
				success,
				execution_time: executionTime,
				intermediate_steps: steps,
				metrics: {
					execution_time: executionTime
				}
			};
		} catch (error: any) {
			// End timing for error case
			const executionTime = Date.now() - startTime;

			// Create error steps
			const errorSteps: IntermediateStep[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'Error',
					output: `API call failed: ${error.message}`
				}
			];

			// Return error response
			return {
				test_id: request.test_id,
				output: `Error: ${error.message}`,
				success: false,
				execution_time: executionTime,
				intermediate_steps: errorSteps,
				metrics: {
					execution_time: executionTime
				}
			};
		}
	}

	/**
	 * Formats the request payload using a template.
	 * 
	 * @param input - The test input string to be formatted
	 * @param template - The template string containing placeholders
	 * @returns any - The formatted request payload as a JSON object
	 * 
	 * @description
	 * This method:
	 * 1. Replaces {{input}} placeholders in the template with the actual input
	 * 2. Parses the resulting string as JSON
	 * 3. Falls back to a simple {input: input} object if parsing fails
	 * 
	 * The template should be a valid JSON string with {{input}} placeholders.
	 */
	private formatRequest(input: string, template: string): any {
		try {
			// Replace input placeholder in template
			const formattedTemplate = template.replace(/\{\{input\}\}/g, input);
			return JSON.parse(formattedTemplate);
		} catch (error: any) {
			console.error('Error formatting request:', error);
			// Fallback to simple input
			return { input };
		}
	}

	/**
	 * Processes the API response and determines test success.
	 * 
	 * @param responseData - The raw response data from the API
	 * @param request - The original test execution request
	 * @param steps - Array of intermediate steps to be updated
	 * @returns { output: string, steps: IntermediateStep[], success: boolean } - Processed response data
	 * 
	 * @description
	 * This method:
	 * 1. Extracts output based on response mapping configuration
	 * 2. Processes intermediate steps if available in the response
	 * 3. Determines test success based on configurable criteria
	 * 4. Supports multiple success criteria types:
	 *    - contains: Checks if output contains a specific value
	 *    - exact_match: Checks for exact string matching
	 *    - json_match: Compares specific JSON paths with operators
	 * 5. Adds processing completion step to the steps array
	 */
	private processResponse(
		responseData: any,
		request: TestExecutionRequest,
		steps: IntermediateStep[]
	): { output: string, steps: IntermediateStep[], success: boolean } {
		let output = '';
		let success = false;

		try {
			if (request.response_mapping) {
				// Parse response mapping
				const mapping: ResponseMapping = JSON.parse(request.response_mapping);

				// Extract output based on mapping
				output = mapping.output
					? this.extractByPath(responseData, mapping.output)
					: (typeof responseData === 'string' ? responseData : JSON.stringify(responseData));

				// Extract and add intermediate steps if mapping exists
				if (mapping.intermediate_steps) {
					const extractedSteps = this.extractByPath(responseData, mapping.intermediate_steps);

					if (Array.isArray(extractedSteps)) {
						// Add each step from the response
						extractedSteps.forEach((step: any) => {
							steps.push({
								timestamp: new Date().toISOString(),
								action: step.action || 'Intermediate Step',
								output: step.output || JSON.stringify(step)
							});
						});
					} else if (extractedSteps) {
						// Add as a single step
						steps.push({
							timestamp: new Date().toISOString(),
							action: 'Intermediate Data',
							output: JSON.stringify(extractedSteps)
						});
					}
				}

				// Determine success based on criteria if provided
				if (mapping.success_criteria) {
					switch (mapping.success_criteria.type) {
						case 'contains':
							success = output.includes(mapping.success_criteria.value);
							break;
						case 'exact_match':
							success = output === mapping.success_criteria.value;
							break;
						case 'json_match':
							if (mapping.success_criteria.path) {
								const actualValue = this.extractByPath(responseData, mapping.success_criteria.path);
								success = this.compareValues(
									actualValue,
									mapping.success_criteria.operator || '==',
									mapping.success_criteria.value
								);
							}
							break;
						default:
							success = false;
					}
				}
			} else {
				// Default extraction
				output = typeof responseData === 'string'
					? responseData
					: (responseData.output || JSON.stringify(responseData));
			}

			// Add processing step
			steps.push({
				timestamp: new Date().toISOString(),
				action: 'Processing Complete',
				output: success ? 'Test execution successful' : 'Test execution unsuccessful'
			});

			return { output, steps, success };
		} catch (error: any) {
			// Add error step
			steps.push({
				timestamp: new Date().toISOString(),
				action: 'Processing Error',
				output: `Error processing response: ${error.message}`
			});

			return {
				output: `Error processing response: ${error.message}`,
				steps,
				success: false
			};
		}
	}

	/**
	 * Extracts a value from an object using dot notation path.
	 * 
	 * @param obj - The source object to extract from
	 * @param path - Dot notation path (e.g., "data.items[0].name")
	 * @returns any - The extracted value or undefined if not found
	 * 
	 * @description
	 * This method:
	 * 1. Splits the path into parts
	 * 2. Traverses the object following the path
	 * 3. Returns undefined if any part of the path is not found
	 * 4. Handles nested object traversal safely
	 */
	private extractByPath(obj: any, path: string): any {
		try {
			const parts = path.split('.');
			let current = obj;

			for (const part of parts) {
				if (current === null || current === undefined) {
					return undefined;
				}
				current = current[part];
			}

			return current;
		} catch (error) {
			console.error('Error extracting path:', path, error);
			return undefined;
		}
	}

	/**
	 * Compares two values using the specified operator.
	 * 
	 * @param left - The left-hand value to compare
	 * @param operator - The comparison operator to use
	 * @param right - The right-hand value to compare against
	 * @returns boolean - The result of the comparison
	 * 
	 * @description
	 * Supported operators:
	 * - == : Loose equality
	 * - === : Strict equality
	 * - != : Loose inequality
	 * - !== : Strict inequality
	 * - > : Greater than
	 * - >= : Greater than or equal
	 * - < : Less than
	 * - <= : Less than or equal
	 */
	private compareValues(left: any, operator: string, right: any): boolean {
		switch (operator) {
			case '==':
				return left == right;
			case '===':
				return left === right;
			case '!=':
				return left != right;
			case '!==':
				return left !== right;
			case '>':
				return left > right;
			case '>=':
				return left >= right;
			case '<':
				return left < right;
			case '<=':
				return left <= right;
			default:
				return false;
		}
	}

	/**
	 * Performs a health check on the service.
	 * 
	 * @returns Promise<boolean> - Always returns true as this is a stateless service
	 * 
	 * @description
	 * This method is used to verify the service is operational.
	 * As this is a stateless service that makes external API calls,
	 * it simply returns true to indicate it's ready to process requests.
	 */
	async healthCheck(): Promise<boolean> {
		return true; // This service doesn't need a health check as it's stateless
	}
}

// Export a singleton instance
export const apiService = new ApiService();
