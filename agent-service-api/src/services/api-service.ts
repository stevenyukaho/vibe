import axios, { AxiosRequestConfig } from 'axios';
import {
	TestExecutionRequest,
	TestExecutionResponse,
	ConversationExecutionRequest,
	ConversationExecutionResponse,
	IntermediateStep,
	ResponseMapping,
	SessionMessage
} from '../types';
import { DEFAULT_TIMEOUT } from '../config';
import { extractTokenUsage } from './token-extractor';

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

			// Extract token usage from response
			const { tokens, metadata } = extractTokenUsage(response.data, request.token_mapping);

			// Add token extraction step if we found tokens
			if (tokens.input_tokens !== undefined || tokens.output_tokens !== undefined) {
				steps.push({
					timestamp: new Date().toISOString(),
					action: 'Token usage extracted',
					output: `Input: ${tokens.input_tokens || 0}, Output: ${tokens.output_tokens || 0}, Method: ${metadata.extraction_method}`
				});
			}

			// Return formatted response
			return {
				test_id: request.test_id,
				output,
				success,
				execution_time: executionTime,
				intermediate_steps: steps,
				metrics: {
					execution_time: executionTime,
					input_tokens: tokens.input_tokens,
					output_tokens: tokens.output_tokens
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
					execution_time: executionTime,
					input_tokens: undefined,
					output_tokens: undefined
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
	 * 1. Properly escapes the input for JSON insertion
	 * 2. Replaces {{input}} placeholders in the template with the escaped input
	 * 3. Parses the resulting string as JSON
	 * 4. Falls back to a simple {input: input} object if parsing fails
	 *
	 * The template should be a valid JSON string with {{input}} placeholders.
	 */
	private formatRequest(input: string, template: string): any {
		try {
			// Properly escape the input for JSON insertion
			const escapedInput = JSON.stringify(input).slice(1, -1); // Remove surrounding quotes

			// Replace input placeholder in template with escaped input
			const formattedTemplate = template.replace(/\{\{input\}\}/g, escapedInput);
			return JSON.parse(formattedTemplate);
		} catch (error: any) {
			console.error('Error formatting request:', error);
			console.error('Template:', template);
			console.error('Input:', input);
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
	 * Executes a conversation using an external API.
	 *
	 * @param request - The conversation execution request containing API configuration and conversation script
	 * @returns Promise<ConversationExecutionResponse> - The conversation execution result including transcript and metrics
	 *
	 * @description
	 * This method:
	 * 1. Iterates through the conversation script messages
	 * 2. For each user message, makes an API call and captures the response
	 * 3. Builds a full transcript of the conversation
	 * 4. Returns the complete conversation history with timing and token usage
	 */
	async executeConversation(request: ConversationExecutionRequest): Promise<ConversationExecutionResponse> {
		const startTime = Date.now();
		const transcript: SessionMessage[] = [];
		const intermediateSteps: IntermediateStep[] = [];
		let totalInputTokens = 0;
		let totalOutputTokens = 0;
		let conversationSuccess = true;

		try {
			// Log conversation start
			intermediateSteps.push({
				timestamp: new Date().toISOString(),
				action: 'Conversation started',
				output: `Starting conversation with ${request.conversation_script.length} scripted messages`
			});

			let conversationHistory = '';

			// Process each message in the conversation script
			for (const scriptMessage of request.conversation_script) {
				if (scriptMessage.role === 'system') {
					// Add system message to transcript
					transcript.push({
						sequence: transcript.length + 1,
						role: 'system',
						content: scriptMessage.content,
						timestamp: new Date().toISOString(),
						metadata: { type: 'system_instruction' }
					});

					conversationHistory += `System: ${scriptMessage.content}\n`;
					continue;
				}

				if (scriptMessage.role === 'user') {
					// Add user message to transcript
					transcript.push({
						sequence: transcript.length + 1,
						role: 'user',
						content: scriptMessage.content,
						timestamp: new Date().toISOString(),
						metadata: { script_sequence: scriptMessage.sequence }
					});

					conversationHistory += `User: ${scriptMessage.content}\n`;

					// Prepare the input for the API call
					// For conversations, we might want to include the history
					const currentInput = request.request_template?.includes('{{conversation_history}}')
						? scriptMessage.content // Use just current message if template handles history
						: conversationHistory;

					const messageStartTime = Date.now();

					intermediateSteps.push({
						timestamp: new Date().toISOString(),
						action: `API call for message ${scriptMessage.sequence}`,
						output: `Processing user message: "${scriptMessage.content.substring(0, 50)}${scriptMessage.content.length > 50 ? '...' : ''}"`
					});

					try {
						// Format request using the template if provided
						const requestPayload = request.request_template
							? this.formatConversationRequest(currentInput, conversationHistory, request.request_template)
							: { input: currentInput };

						const headers = {
							'Content-Type': 'application/json',
							...request.headers,
							...(request.api_key ? { 'Authorization': `Bearer ${request.api_key}` } : {})
						};

						const config: AxiosRequestConfig = {
							headers,
							timeout: DEFAULT_TIMEOUT
						};

						// Get HTTP method, default to POST
						const httpMethod = request.http_method || 'POST';

						let response;
						if (httpMethod === 'GET') {
							const url = new URL(request.api_endpoint);
							Object.entries(requestPayload).forEach(([key, value]) => {
								url.searchParams.append(key, String(value));
							});
							response = await axios.get(url.toString(), config);
						} else {
							response = await axios({
								method: httpMethod.toLowerCase(),
								url: request.api_endpoint,
								data: requestPayload,
								...config
							});
						}

						const messageExecutionTime = Date.now() - messageStartTime;

						// Process the response for this message
						const { output, steps, success } = this.processResponse(
							response.data,
							{
								...request,
								test_input: scriptMessage.content,
								test_id: request.conversation_id
							} as TestExecutionRequest,
							[]
						);

						// Add processing steps to conversation-level steps
						steps.forEach(step => {
							intermediateSteps.push({
								...step,
								action: `Message ${scriptMessage.sequence}: ${step.action}`
							});
						});

						// Extract token usage for this message
						const { tokens } = extractTokenUsage(response.data, request.token_mapping);
						if (tokens.input_tokens) totalInputTokens += tokens.input_tokens;
						if (tokens.output_tokens) totalOutputTokens += tokens.output_tokens;

						// Add assistant response to transcript
						transcript.push({
							sequence: transcript.length + 1,
							role: 'assistant',
							content: output,
							timestamp: new Date().toISOString(),
							metadata: {
								script_sequence: scriptMessage.sequence,
								execution_time_ms: messageExecutionTime,
								success: success,
								input_tokens: tokens.input_tokens,
								output_tokens: tokens.output_tokens
							}
						});

						conversationHistory += `Assistant: ${output}\n`;

						if (!success) {
							conversationSuccess = false;
						}

						intermediateSteps.push({
							timestamp: new Date().toISOString(),
							action: `Message ${scriptMessage.sequence} Completed`,
							output: `Response received: "${output.substring(0, 100)}${output.length > 100 ? '...' : ''}"`
						});

					} catch (messageError: any) {
						const errorMessage = `Error in message ${scriptMessage.sequence}: ${messageError.message}`;

						intermediateSteps.push({
							timestamp: new Date().toISOString(),
							action: `Message ${scriptMessage.sequence} Error`,
							output: errorMessage
						});

						// Add error to transcript
						transcript.push({
							sequence: transcript.length + 1,
							role: 'assistant',
							content: `Error: ${messageError.message}`,
							timestamp: new Date().toISOString(),
							metadata: {
								script_sequence: scriptMessage.sequence,
								error: true,
								error_message: messageError.message
							}
						});

						conversationSuccess = false;
					}
				}
			}

			const totalExecutionTime = Date.now() - startTime;

			intermediateSteps.push({
				timestamp: new Date().toISOString(),
				action: 'Conversation completed',
				output: `Conversation completed with ${transcript.length} messages. Success: ${conversationSuccess}`
			});

			return {
				conversation_id: request.conversation_id,
				transcript,
				success: conversationSuccess,
				execution_time: totalExecutionTime,
				intermediate_steps: intermediateSteps,
				metrics: {
					execution_time: totalExecutionTime,
					input_tokens: totalInputTokens,
					output_tokens: totalOutputTokens
				}
			};

		} catch (error: any) {
			const totalExecutionTime = Date.now() - startTime;

			intermediateSteps.push({
				timestamp: new Date().toISOString(),
				action: 'Conversation error',
				output: `Conversation failed: ${error.message}`
			});

			return {
				conversation_id: request.conversation_id,
				transcript,
				success: false,
				execution_time: totalExecutionTime,
				intermediate_steps: intermediateSteps,
				metrics: {
					execution_time: totalExecutionTime,
					input_tokens: totalInputTokens,
					output_tokens: totalOutputTokens
				}
			};
		}
	}

	/**
	 * Formats a conversation request using a template that supports both current input and conversation history.
	 *
	 * @param currentInput - The current user message
	 * @param conversationHistory - The full conversation history so far
	 * @param template - The template string containing placeholders
	 * @returns any - The formatted request payload as a JSON object
	 */
	private formatConversationRequest(currentInput: string, conversationHistory: string, template: string): any {
		try {
			// Escape inputs for JSON insertion
			const escapedCurrentInput = JSON.stringify(currentInput).slice(1, -1);
			const escapedHistory = JSON.stringify(conversationHistory).slice(1, -1);

			// Replace placeholders in template
			let formattedTemplate = template
				.replace(/\{\{input\}\}/g, escapedCurrentInput)
				.replace(/\{\{conversation_history\}\}/g, escapedHistory);

			return JSON.parse(formattedTemplate);
		} catch (error: any) {
			console.error('Error formatting conversation request:', error);
			console.error('Template:', template);
			console.error('Current input:', currentInput);

			return { input: currentInput };
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
