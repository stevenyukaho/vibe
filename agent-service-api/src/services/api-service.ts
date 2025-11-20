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

			// Log the API call as an intermediate step
			const intermediateSteps: IntermediateStep[] = [
				{
					timestamp: new Date().toISOString(),
					action: 'API Call Initiated',
					output: `Calling ${request.api_endpoint}`
				}
			];

			// Make the API request
			const response = await this.makeApiRequest(
				request.api_endpoint,
				request.http_method || 'POST',
				requestPayload,
				request.headers,
				request.api_key
			);

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
	 * Escapes a string value for safe JSON insertion into a template.
	 * Removes surrounding quotes from JSON.stringify output for embedding in strings.
	 *
	 * @param value - The value to escape
	 * @returns Escaped string without surrounding quotes
	 */
	private escapeForJsonTemplate(value: string): string {
		return JSON.stringify(value).slice(1, -1);
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
			const escapedInput = this.escapeForJsonTemplate(input);

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
	): { output: string, steps: IntermediateStep[], success: boolean, extractedVariables?: Record<string, any> } {
		let output = '';
		let success = false;
		let extractedVariables: Record<string, any> | undefined;

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

				// Extract variables if requested
				if (mapping.variables && typeof mapping.variables === 'object') {
					extractedVariables = {};
					for (const [varName, varPath] of Object.entries(mapping.variables)) {
						try {
							const value = this.extractByPath(responseData, varPath as string);
							if (value !== undefined) {
								extractedVariables[varName] = value;
							}
						} catch {
							// ignore individual extraction failures
						}
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

			return { output, steps, success, extractedVariables };
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
				success: false,
				extractedVariables
			};
		}
	}

	/**
	 * Tokenizes a path string into an array of property names and array indices.
	 * Supports dot notation (a.b.c) and bracket notation (a[0]['key']).
	 *
	 * @param path - Path string (e.g., "data.items[0].name" or "choices.0.message.content")
	 * @returns Array of tokens (strings or numbers) representing the path segments
	 */
	private tokenizePath(path: string): (string | number)[] {
		const tokens: (string | number)[] = [];
		const dotParts = path.split('.');

		for (const part of dotParts) {
			const regex = /([^\[\]]+)|\[(\d+|'.*?'|".*?")\]/g;
			let match: RegExpExecArray | null;

			while ((match = regex.exec(part)) !== null) {
				if (match[1]) {
					tokens.push(match[1]);
				} else if (match[2]) {
					const raw = match[2];
					if (/^\d+$/.test(raw)) {
						tokens.push(Number(raw));
					} else {
						tokens.push(String(raw).slice(1, -1));
					}
				}
			}
		}

		return tokens;
	}

	/**
	 * Traverses an object using an array of tokens to extract a nested value.
	 *
	 * @param obj - The source object to traverse
	 * @param tokens - Array of property names and indices
	 * @returns The extracted value or undefined if not found
	 */
	private traverseByTokens(obj: any, tokens: (string | number)[]): any {
		let current = obj;
		for (const token of tokens) {
			if (current === null || current === undefined) {
				return undefined;
			}
			current = current[token as any];
		}
		return current;
	}

	/**
	 * Extracts a value from an object using dot/bracket notation path.
	 *
	 * @param obj - The source object to extract from
	 * @param path - Path (e.g., "data.items[0].name" or "choices.0.message.content")
	 * @returns any - The extracted value or undefined if not found
	 *
	 * @description
	 * This method:
	 * 1. Parses the path into tokens supporting '.' and '[idx]' access
	 * 2. Traverses the object following the tokens
	 * 3. Returns undefined if any part of the path is not found
	 * 4. Handles nested object traversal safely
	 */
	private extractByPath(obj: any, path: string): any {
		try {
			if (!path || typeof path !== 'string') return undefined;
			const tokens = this.tokenizePath(path);
			return this.traverseByTokens(obj, tokens);
		} catch (error) {
			console.error('Error extracting path:', path, error);
			return undefined;
		}
	}

	/**
	 * Makes an HTTP request to an external API with proper headers, authentication, and method handling.
	 *
	 * @param endpoint - The API endpoint URL
	 * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
	 * @param payload - Request payload data
	 * @param headers - Additional headers to include
	 * @param apiKey - Optional API key for authentication
	 * @returns Promise with the axios response
	 */
	private async makeApiRequest(
		endpoint: string,
		method: string,
		payload: any,
		headers?: Record<string, string>,
		apiKey?: string
	): Promise<any> {
		const requestHeaders = {
			'Content-Type': 'application/json',
			...headers,
			...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
		};

		const config: AxiosRequestConfig = {
			headers: requestHeaders,
			timeout: DEFAULT_TIMEOUT
		};

		const httpMethod = method || 'POST';

		if (httpMethod === 'GET') {
			const url = new URL(endpoint);
			Object.entries(payload).forEach(([key, value]) => {
				url.searchParams.append(key, String(value));
			});
			return await axios.get(url.toString(), config);
		} else {
			return await axios({
				method: httpMethod.toLowerCase(),
				url: endpoint,
				data: payload,
				...config
			});
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
	 * Resolves a pointer expression (e.g. "$.lastResponse.id") against a context object.
	 */
	private resolvePointer(pointer: string, context: Record<string, any>): any {
		try {
			if (typeof pointer !== 'string' || !pointer.startsWith('$.')) {
				return pointer;
			}

			const path = pointer.slice(2);
			const tokens = this.tokenizePath(path);

			return this.traverseByTokens(context, tokens);
		} catch {
			return undefined;
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
		let accumulatedVariables: Record<string, any> = {};
		let lastRequestPayload: any = undefined;
		let lastResponseData: any = undefined;

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
					// Prepare the input for the API call
					// For conversations, we might want to include the history
					const effectiveTemplateForMessage = (scriptMessage as any)?.metadata?.request_template || request.request_template;
					const effectiveResponseMappingForMessage = (scriptMessage as any)?.metadata?.response_mapping || request.response_mapping;
					// Robustly detect if template references conversation_history (allowing whitespace)
					const templateIncludesHistory = typeof effectiveTemplateForMessage === 'string'
						? /\{\{\s*conversation_history\s*\}\}/.test(effectiveTemplateForMessage)
						: false;
					// History-first mode should include the current user message in input
					const historyIncludingCurrent = `${conversationHistory}User: ${scriptMessage.content}\n`;
					const currentInput = templateIncludesHistory
						? scriptMessage.content // Use just current message if template handles history explicitly
						: historyIncludingCurrent; // Otherwise, input is full history including current turn

					const messageStartTime = Date.now();

					intermediateSteps.push({
						timestamp: new Date().toISOString(),
						action: `API call for message ${scriptMessage.sequence}`,
						output: `Processing user message: "${scriptMessage.content.substring(0, 50)}${scriptMessage.content.length > 50 ? '...' : ''}"`
					});

					try {
						// Format request using the template if provided (per-message override supported via metadata)
						const varsForMessage = ((scriptMessage as any)?.metadata?.variables) || {};
						const pointerContext = {
							lastRequest: lastRequestPayload,
							lastResponse: lastResponseData,
							variables: accumulatedVariables,
							conversation: {
								id: request.conversation_id,
								history: conversationHistory,
								script: request.conversation_script
							},
							message: scriptMessage,
							request,
							transcript
						};
						const resolvedMessageVars: Record<string, any> = {};
						for (const [key, value] of Object.entries(varsForMessage)) {
							if (typeof value === 'string' && value.startsWith('$.')) {
								const resolved = this.resolvePointer(value, pointerContext);
								if (resolved !== undefined) {
									resolvedMessageVars[key] = resolved;
								}
							} else {
								resolvedMessageVars[key] = value;
							}
						}
						const mergedVars = { ...accumulatedVariables, ...resolvedMessageVars };

						// Add user message to transcript with pre-call variables
						transcript.push({
							sequence: transcript.length + 1,
							role: 'user',
							content: scriptMessage.content,
							timestamp: new Date().toISOString(),
							metadata: {
								script_sequence: scriptMessage.sequence,
								variables_before: Object.keys(mergedVars).length ? mergedVars : undefined
							}
						});

						conversationHistory += `User: ${scriptMessage.content}\n`;
						const requestPayload = effectiveTemplateForMessage
							? this.formatConversationRequestWithVars(currentInput, conversationHistory, effectiveTemplateForMessage, mergedVars)
							: { input: currentInput };
						lastRequestPayload = requestPayload;

						// Make the API request
						const response = await this.makeApiRequest(
							request.api_endpoint,
							request.http_method || 'POST',
							requestPayload,
							request.headers,
							request.api_key
						);
						lastResponseData = response.data;

						const messageExecutionTime = Date.now() - messageStartTime;

						// Process the response for this message
						const { output, steps, success, extractedVariables } = this.processResponse(
							response.data,
							{
								...request,
								test_input: scriptMessage.content,
								test_id: request.conversation_id,
								// Per-message mapping if provided
								response_mapping: effectiveResponseMappingForMessage || request.response_mapping
							} as TestExecutionRequest,
							[]
						);

						// Merge extracted variables into accumulator for future turns
						let nextVariables = { ...mergedVars };
						if (extractedVariables && Object.keys(extractedVariables).length > 0) {
							nextVariables = { ...nextVariables, ...extractedVariables };
						}
						accumulatedVariables = nextVariables;

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

						// Add assistant response to transcript with post-call variables
						transcript.push({
							sequence: transcript.length + 1,
							role: 'assistant',
							content: output,
							timestamp: new Date().toISOString(),
							metadata: {
								script_sequence: scriptMessage.sequence,
								execution_time_ms: messageExecutionTime,
								success: success,
								request_template_used: effectiveTemplateForMessage ? 'custom' : undefined,
								response_mapping_used: effectiveResponseMappingForMessage ? 'custom' : undefined,
								variables_before: Object.keys(mergedVars || {}).length ? mergedVars : undefined,
								variables_after: Object.keys(accumulatedVariables || {}).length ? accumulatedVariables : undefined,
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

						// Stop the conversation on failure if requested
						if (request.stop_on_failure && !success) {
							intermediateSteps.push({
								timestamp: new Date().toISOString(),
								action: 'Conversation stopped',
								output: `Stopped after message ${scriptMessage.sequence} due to failure condition`
							});
							break;
						}

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

						if (request.stop_on_failure) {
							intermediateSteps.push({
								timestamp: new Date().toISOString(),
								action: 'Conversation stopped',
								output: `Stopped after message ${scriptMessage.sequence} due to error`
							});
							break;
						}
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
				variables: accumulatedVariables,
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
				variables: accumulatedVariables,
				metrics: {
					execution_time: totalExecutionTime,
					input_tokens: totalInputTokens,
					output_tokens: totalOutputTokens
				}
			};
		}
	}

	/**
	 * Formats a conversation request with variables, supporting {{input}}, {{conversation_history}}, and {{var}} placeholders.
	 * Variables are injected as strings unless the template author places the placeholder without quotes to embed JSON.
	 */
	private formatConversationRequestWithVars(currentInput: string, conversationHistory: string, template: string, variables: Record<string, any>): any {
		try {
			// Escape inputs for JSON insertion into quoted contexts
			const escapedCurrentInput = this.escapeForJsonTemplate(currentInput);
			const escapedHistory = this.escapeForJsonTemplate(conversationHistory);

			let formatted = template
				.replace(/\{\{\s*input\s*\}\}/g, escapedCurrentInput)
				.replace(/\{\{\s*conversation_history\s*\}\}/g, escapedHistory);

			// Replace any {{var}} placeholders with string-escaped versions by default
			// Now supports bracket notation like users[0].name or data['key']
			formatted = formatted.replace(/\{\{\s*([a-zA-Z0-9_\.\[\]'"]+)\s*\}\}/g, (_match, p1: string) => {
				// skip ones we've already replaced
				if (p1 === 'input' || p1 === 'conversation_history') return _match;
				// resolve nested variable paths using the robust extractByPath method
				const value = this.extractByPath(variables, p1);
				if (value === undefined || value === null) {
					return '';
				}
				// Default: inject into quoted strings; author can omit quotes to embed objects
				if (typeof value === 'string') {
					return JSON.stringify(value).slice(1, -1);
				}
				try {
					return JSON.stringify(value);
				} catch {
					return String(value);
				}
			});

			return JSON.parse(formatted);
		} catch (error: any) {
			console.error('Error formatting conversation request with variables:', error);
			console.error('Template:', template);
			console.error('Current input:', currentInput);
			return { input: currentInput, variables };
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
