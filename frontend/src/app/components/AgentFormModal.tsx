import { useState, useEffect } from 'react';
import {
	Modal,
	TextInput,
	TextArea,
	Form,
	Stack,
	Button,
	RadioButtonGroup,
	RadioButton,
	InlineNotification,
	Accordion,
	AccordionItem,
	CodeSnippet,
	Dropdown
} from '@carbon/react';
import { Launch } from '@carbon/icons-react';
import { api } from '@/lib/api';
import styles from './AgentFormModal.module.scss';

interface AgentFormModalProps {
	isOpen: boolean;
	editingId?: number | null;
	formData: Record<string, string>;
	onClose: () => void;
	onSuccess: () => void;
}

export default function AgentFormModal({
	isOpen,
	editingId,
	formData: initialFormData,
	onClose,
	onSuccess
}: AgentFormModalProps) {
	// State for form data
	const [formData, setFormData] = useState<Record<string, string>>(initialFormData || {});
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Update form data when initialFormData changes
	useEffect(() => {
		if (isOpen && initialFormData) {
			setFormData(initialFormData);
		}
	}, [isOpen, initialFormData]);

	// State for API connection testing
	const [testConnectionStatus, setTestConnectionStatus] = useState<{
		loading: boolean;
		success?: boolean;
		message?: string;
	} | null>(null);

	// Form input change handler
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setFormData({
			...formData,
			[e.target.id]: e.target.value
		});
	};

	// Handle form submission
	const handleSubmit = async () => {
		setIsSaving(true);
		setError(null);
		try {
			// Parse existing settings or create new empty object
			let settings: Record<string, unknown> = {};
			try {
				if (formData['agent-settings']) {
					settings = JSON.parse(formData['agent-settings']);
				}
			} catch (error) {
				// JSON parsing error
				console.error('Error parsing agent settings:', error);
				setError('Invalid JSON in settings field');
				setIsSaving(false);
				return;
			}

			// Set agent type
			settings.type = formData['agent-type'] === 'external_api' ? 'external_api' : 'crew_ai';

			// Validate required fields based on agent type
			if (settings.type === 'external_api') {
				// API endpoint is required for external API agents
				if (!formData['agent-api-endpoint']) {
					setError('API Endpoint is required for External API agents');
					setIsSaving(false);
					return;
				}

				// Validate API endpoint URL format
				try {
					new URL(formData['agent-api-endpoint']);
				} catch (error) {
					console.error('Invalid URL format:', error);
					setError('Invalid API Endpoint URL format');
					setIsSaving(false);
					return;
				}

				// Validate request template JSON if provided
				if (formData['agent-request-template']) {
					try {
						// Make sure it contains the input placeholder
						const template = formData['agent-request-template'];
						if (!template.includes('{{input}}')) {
							setError('Request template must include {{input}} placeholder');
							setIsSaving(false);
							return;
						}

						// Verify it's valid JSON when the placeholder is replaced
						JSON.parse(template.replace(/\{\{input\}\}/g, 'test'));
					} catch (error) {
						console.error('Invalid JSON in request template:', error);
						setError('Invalid JSON in request template');
						setIsSaving(false);
						return;
					}
				}

				// Validate response mapping JSON if provided
				if (formData['agent-response-mapping'] !== undefined) {
					if (formData['agent-response-mapping']) {
						settings = {
							...settings,
							response_mapping: formData['agent-response-mapping']
						};
					} else {
						delete settings['response_mapping'];
					}
				}

				// Validate headers JSON if provided
				if (formData['agent-headers'] !== undefined) {
					try {
						if (formData['agent-headers']) {
							settings = {
								...settings,
								headers: JSON.parse(formData['agent-headers'])
							};
						} else {
							delete settings['headers'];
						}
					} catch (error) {
						console.error('Error parsing headers:', error);
						// If invalid JSON, don't add headers
					}
				}
			}

			// For CrewAI type, add model and base URL settings
			if (settings.type === 'crew_ai') {
				// Add the Ollama base URL to settings
				if (formData['agent-ollama-url']) {
					settings = {
						...settings,
						base_url: formData['agent-ollama-url']
					};
				}

				// Add the model name to settings
				if (formData['agent-model']) {
					settings = {
						...settings,
						model: formData['agent-model']
					};
				}

				// Add role, goal, and backstory if provided
				if (formData['agent-role']) {
					settings = {
						...settings,
						role: formData['agent-role']
					};
				}

				if (formData['agent-goal']) {
					settings = {
						...settings,
						goal: formData['agent-goal']
					};
				}

				if (formData['agent-backstory']) {
					settings = {
						...settings,
						backstory: formData['agent-backstory']
					};
				}

				// Add temperature if provided
				if (formData['agent-temperature']) {
					settings = {
						...settings,
						temperature: parseFloat(formData['agent-temperature'])
					};
				}

				// Add max_tokens if provided
				if (formData['agent-max-tokens']) {
					settings = {
						...settings,
						max_tokens: parseInt(formData['agent-max-tokens'], 10)
					};
				}
			} else if (settings.type === 'external_api') {
				// For External API type, add API endpoint settings
				if (formData['agent-api-endpoint']) {
					settings = {
						...settings,
						api_endpoint: formData['agent-api-endpoint']
					};
				}

				// Add API key if provided
				if (formData['agent-api-key']) {
					settings = {
						...settings,
						api_key: formData['agent-api-key']
					};
				}

				// Add HTTP method if provided, default to POST
				if (formData['agent-http-method']) {
					settings = {
						...settings,
						http_method: formData['agent-http-method']
					};
				}

				// Add request template if provided
				if (formData['agent-request-template']) {
					settings = {
						...settings,
						request_template: formData['agent-request-template']
					};
				}

				// Add response mapping if provided
				if (formData['agent-response-mapping'] !== undefined) {
					if (formData['agent-response-mapping']) {
						settings = {
							...settings,
							response_mapping: formData['agent-response-mapping']
						};
					} else {
						delete settings['response_mapping'];
					}
				}

				// Add token mapping if provided
				if (formData['agent-token-mapping'] !== undefined) {
					if (formData['agent-token-mapping']) {
						try {
							JSON.parse(formData['agent-token-mapping']);
							settings = {
								...settings,
								token_mapping: formData['agent-token-mapping']
							};
						} catch (error) {
							console.error('Invalid token mapping JSON:', error);
							setError('Invalid JSON in token mapping');
							setIsSaving(false);
							return;
						}
					} else {
						delete settings['token_mapping'];
					}
				}

				// Add headers if provided
				if (formData['agent-headers'] !== undefined) {
					try {
						if (formData['agent-headers']) {
							settings = {
								...settings,
								headers: JSON.parse(formData['agent-headers'])
							};
						} else {
							delete settings['headers'];
						}
					} catch (error) {
						console.error('Error parsing headers:', error);
						// If invalid JSON, don't add headers
					}
				}
			}

			const agentData = {
				name: formData['agent-name'],
				version: formData['agent-version'],
				prompt: formData['agent-prompt'],
				settings: JSON.stringify(settings)
			};

			if (editingId) {
				// Update existing agent
				await api.updateAgent(editingId, agentData);
			} else {
				// Create new agent
				await api.createAgent(agentData);
			}

			// Notify parent of success and close modal
			onSuccess();
			onClose();
		} catch (error) {
			console.error('Error saving agent:', error);
			setError(error instanceof Error ? error.message : 'An unknown error occurred');
		} finally {
			setIsSaving(false);
		}
	};

	// Test API connection
	const testApiConnection = async () => {
		// Reset status
		setTestConnectionStatus({ loading: true });

		try {
			// Validate required fields
			if (!formData['agent-api-endpoint']) {
				setTestConnectionStatus({
					loading: false,
					success: false,
					message: 'API Endpoint is required'
				});
				return;
			}

			// Validate URL format
			try {
				new URL(formData['agent-api-endpoint']);
			} catch (error) {
				console.error('Invalid URL format:', error);
				setTestConnectionStatus({
					loading: false,
					success: false,
					message: 'Invalid API Endpoint URL format'
				});
				return;
			}

			// Prepare headers
			let headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			// Add API key if provided
			if (formData['agent-api-key']) {
				headers['Authorization'] = `Bearer ${formData['agent-api-key']}`;
			}

			// Add custom headers if provided
			if (formData['agent-headers']) {
				try {
					const customHeaders = JSON.parse(formData['agent-headers']);
					headers = { ...headers, ...customHeaders };
				} catch (error) {
					console.error('Invalid headers JSON:', error);
					// Invalid JSON, ignore
				}
			}

			// Prepare request body
			let body = { test: 'connection' };

			// Use request template if provided
			if (formData['agent-request-template']) {
				try {
					const template = formData['agent-request-template'].replace(/\{\{input\}\}/g, 'test connection');
					body = JSON.parse(template);
				} catch (error) {
					console.error('Invalid request template:', error);
					// Invalid JSON, use default
				}
			}

			// Make the request
			const response = await fetch(formData['agent-api-endpoint'], {
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			});

			if (response.ok) {
				setTestConnectionStatus({
					loading: false,
					success: true,
					message: `Connection successful! Status: ${response.status}`
				});
			} else {
				setTestConnectionStatus({
					loading: false,
					success: false,
					message: `Connection failed. Status: ${response.status} ${response.statusText}`
				});
			}
		} catch (error) {
			console.error('Connection error:', error);
			setTestConnectionStatus({
				loading: false,
				success: false,
				message: `Connection error: ${(error as Error).message}`
			});
		}
	};

	return (
		<Modal
			open={isOpen}
			modalHeading={`${editingId ? 'Edit' : 'Add New'} Agent`}
			primaryButtonText={isSaving ? 'Saving...' : 'Save'}
			secondaryButtonText="Cancel"
			onRequestClose={onClose}
			onRequestSubmit={handleSubmit}
			primaryButtonDisabled={isSaving}
		>
			{error && (
				<InlineNotification
					kind="error"
					title="Error"
					subtitle={error}
					hideCloseButton
					lowContrast
					className={styles.errorNotification}
				/>
			)}
			<Form>
				<Stack gap={7}>
					<TextInput
						id="agent-name"
						labelText="Name"
						placeholder="Enter agent name"
						value={formData['agent-name'] || ''}
						onChange={handleInputChange}
					/>
					<TextInput
						id="agent-version"
						labelText="Version"
						placeholder="Enter version"
						value={formData['agent-version'] || ''}
						onChange={handleInputChange}
					/>

					{/* Agent Type Selection */}
					<RadioButtonGroup
						legendText="Agent Type"
						name="agent-type"
						orientation="horizontal"
						valueSelected={formData['agent-type'] || 'crew_ai'}
						onChange={(value) => {
							handleInputChange({
								target: { id: 'agent-type', value }
							} as React.ChangeEvent<HTMLInputElement>);
						}}
					>
						<RadioButton
							id="crew_ai"
							labelText="CrewAI Agent"
							value="crew_ai"
						/>
						<RadioButton
							id="external_api"
							labelText="External API Agent"
							value="external_api"
						/>
					</RadioButtonGroup>

					{/* Show different fields based on agent type */}
					{(formData['agent-type'] !== 'external_api') ? (
						<>
							{/* CrewAI Agent Configuration */}
							<TextInput
								id="agent-role"
								labelText="Role"
								placeholder="Enter agent role (e.g., AI Assistant)"
								value={formData['agent-role'] || ''}
								onChange={handleInputChange}
							/>
							<TextInput
								id="agent-goal"
								labelText="Goal"
								placeholder="Enter agent goal (e.g., Help the user with their tasks)"
								value={formData['agent-goal'] || ''}
								onChange={handleInputChange}
							/>
							<TextArea
								id="agent-backstory"
								labelText="Backstory"
								placeholder="Enter agent backstory"
								rows={2}
								value={formData['agent-backstory'] || ''}
								onChange={handleInputChange}
							/>
							<TextInput
								id="agent-model"
								labelText="Model Name"
								placeholder="Enter model name (e.g., llama3, mistral, etc.)"
								value={formData['agent-model'] || ''}
								onChange={handleInputChange}
							/>
							<div style={{ display: 'flex', gap: '1rem' }}>
								<TextInput
									id="agent-temperature"
									labelText="Temperature"
									placeholder="0.7"
									value={formData['agent-temperature'] || ''}
									onChange={handleInputChange}
									style={{ flex: 1 }}
								/>
								<TextInput
									id="agent-max-tokens"
									labelText="Max Tokens"
									placeholder="1000"
									value={formData['agent-max-tokens'] || ''}
									onChange={handleInputChange}
									style={{ flex: 1 }}
								/>
							</div>
							<TextInput
								id="agent-ollama-url"
								labelText="Ollama Base URL"
								placeholder="Enter Ollama base URL (e.g., http://your-ollama-host:11434)"
								value={formData['agent-ollama-url'] || ''}
								onChange={handleInputChange}
							/>
						</>
					) : (
						<>
							{/* External API Agent Configuration */}
							<TextInput
								id="agent-api-endpoint"
								labelText="API Endpoint"
								placeholder="Enter API endpoint URL (e.g., https://api.example.com/v1/completion)"
								value={formData['agent-api-endpoint'] || ''}
								onChange={handleInputChange}
								required
							/>
							<Dropdown
								id="agent-http-method"
								titleText="HTTP Method"
								label="Select HTTP method"
								items={[
									{ id: 'POST', label: 'POST' },
									{ id: 'GET', label: 'GET' },
									{ id: 'PUT', label: 'PUT' },
									{ id: 'PATCH', label: 'PATCH' },
									{ id: 'DELETE', label: 'DELETE' }
								]}
								selectedItem={
									formData['agent-http-method']
										? { id: formData['agent-http-method'], label: formData['agent-http-method'] }
										: { id: 'POST', label: 'POST' }
								}
								onChange={(e) => {
									const event = {
										target: {
											id: 'agent-http-method',
											value: e.selectedItem?.id || 'POST'
										}
									} as React.ChangeEvent<HTMLInputElement>;
									handleInputChange(event);
								}}
								helperText="HTTP method to use for API requests (default: POST)"
							/>
							<TextInput
								id="agent-api-key"
								labelText="API Key (Optional)"
								placeholder="Enter API key for authentication"
								value={formData['agent-api-key'] || ''}
								onChange={handleInputChange}
								type="password"
							/>
							<TextArea
								id="agent-request-template"
								labelText="Request Template (Optional)"
								placeholder='JSON template with {{input}} placeholder, e.g.: {"prompt": "{{input}}", "max_tokens": 1000}'
								rows={4}
								value={formData['agent-request-template'] || ''}
								onChange={handleInputChange}
								helperText="Use {{input}} as a placeholder for the test input"
							/>
							<TextArea
								id="agent-response-mapping"
								labelText="Response Mapping (Optional)"
								placeholder='JSON mapping to extract response, e.g.: {"output": "choices.0.text", "success_criteria": {"type": "contains", "value": "completed"}}'
								rows={4}
								value={formData['agent-response-mapping'] || ''}
								onChange={handleInputChange}
								helperText="Specify how to extract output and determine success"
							/>
							<TextArea
								id="agent-token-mapping"
								labelText="Token mapping (Optional)"
								placeholder='JSON mapping to extract token usage, e.g.: {"input_tokens": "usage.prompt_tokens", "output_tokens": "usage.completion_tokens"}'
								rows={3}
								value={formData['agent-token-mapping'] || ''}
								onChange={handleInputChange}
								helperText="Leave empty for auto-detection (works with OpenAI, Claude, Gemini, etc.) or specify custom mapping"
							/>
							<TextArea
								id="agent-headers"
								labelText="Headers (Optional)"
								placeholder='Enter custom headers as JSON, e.g.: {"Content-Type": "application/json", "X-Custom-Header": "value"}'
								rows={3}
								value={formData['agent-headers'] || ''}
								onChange={handleInputChange}
								helperText="Custom HTTP headers as JSON object"
							/>

							{/* Test Connection Button */}
							<div className={styles.testConnection}>
								<Button
									kind="tertiary"
									onClick={testApiConnection}
									disabled={!formData['agent-api-endpoint'] || testConnectionStatus?.loading}
									renderIcon={Launch}
									size="sm"
								>
									{testConnectionStatus?.loading ? 'Testing...' : 'Test Connection'}
								</Button>

								{testConnectionStatus && !testConnectionStatus.loading && (
									<InlineNotification 
										className={styles.testConnectionStatus}
										kind={testConnectionStatus.success ? 'success' : 'error'}
										title={testConnectionStatus.success ? 'Success' : 'Error'}
										subtitle={testConnectionStatus.message}
										hideCloseButton
										lowContrast
									/>
								)}
							</div>
						</>
					)}

					<TextArea
						id="agent-prompt"
						labelText="Prompt"
						placeholder="Enter agent prompt"
						rows={4}
						value={formData['agent-prompt'] || ''}
						onChange={handleInputChange}
					/>

					{formData['agent-type'] !== 'external_api' && (
						<TextArea
							id="agent-settings"
							labelText="Advanced Settings (JSON)"
							placeholder="Enter agent settings as JSON"
							rows={4}
							value={formData['agent-settings'] || ''}
							onChange={handleInputChange}
						/>
					)}

					{/* Help Panel */}
					<Accordion>
						<AccordionItem title="Need help?">
							<div className={styles.helpSection}>
								<h5 className={styles.sectionHeading}>Request Template</h5>
								<p className={styles.helpText}>The request template formats your test input for the external API. It should be a valid JSON string with a placeholder for where the test input should go.</p>
								<ul className={styles.helpList}>
									<li className={styles.listItem}>Must include <code>{'{{input}}'}</code> as a placeholder for the test input</li>
									<li className={styles.listItem}>Should be valid JSON when the placeholder is replaced with text</li>
								</ul>
								<h6 className={styles.exampleHeading}>Example for OpenAI:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										model: 'gpt-4', 
										messages: [
											{ role: 'user', content: '{{input}}' }
										]
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Anthropic/Claude:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										model: 'claude-3-5-sonnet-20240620', 
										messages: [
											{ role: 'user', content: '{{input}}' }
										],
										max_tokens: 1024
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Google Gemini:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										contents: [
											{ role: 'user', parts: [{ text: '{{input}}' }] }
										],
										generationConfig: {
											temperature: 0.7,
											maxOutputTokens: 1024
										}
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Mistral AI:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										model: 'mistral-large-latest', 
										messages: [
											{ role: 'user', content: '{{input}}' }
										],
										temperature: 0.7,
										max_tokens: 1000
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Cohere:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										message: '{{input}}',
										model: 'command',
										temperature: 0.7,
										max_tokens: 1000
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Ollama:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										model: 'llama3',
										prompt: '{{input}}',
										options: {
											temperature: 0.7,
											num_predict: 1000
										}
									}, null, 2)}
								</CodeSnippet>

								<h5 className={styles.subSectionHeading}>Response Mapping</h5>
								<p className={styles.helpText}>Response mapping is required when using External API Agent type. It tells the system how to extract information from the API response.</p>
								<ul className={styles.helpList}>
									<li className={styles.listItem}>The <strong>&quot;output&quot;</strong> field is mandatory and should point to where the main content is in the response</li>
									<li className={styles.listItem}>Use dot notation to access nested properties (e.g., &quot;choices.0.message.content&quot;)</li>
									<li className={styles.listItem}>You can include optional <strong>&quot;success_criteria&quot;</strong> to determine if the response was successful</li>
								</ul>
								<h6 className={styles.exampleHeading}>Example for OpenAI:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ output: 'choices.0.message.content' }, null, 2)}
								</CodeSnippet>
								<h6 className={styles.exampleHeading}>Example for Claude:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ output: 'content.0.text' }, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Google Gemini:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ output: 'candidates.0.content.parts.0.text' }, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Mistral AI:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ output: 'choices.0.message.content' }, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Cohere:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ output: 'text' }, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Ollama:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ output: 'response' }, null, 2)}
								</CodeSnippet>

								<h5 className={styles.subSectionHeading}>Token mapping</h5>
								<p className={styles.helpText}>Token mapping is <strong>optional</strong> for External API agents. If not provided, the system will automatically detect token usage for most popular platforms!</p>
								<ul className={styles.helpList}>
									<li className={styles.listItem}><strong>Auto-detection works for:</strong> OpenAI, Anthropic/Claude, Google Gemini, Mistral AI, Cohere, Ollama, and LangChain</li>
									<li className={styles.listItem}>Only specify if using a custom API or if auto-detection fails</li>
									<li className={styles.listItem}>Use dot notation to access nested properties</li>
									<li className={styles.listItem}>Supports both separate input/output tokens and total tokens only</li>
								</ul>
								
								<h6 className={styles.exampleHeading}>Example for OpenAI (auto-detected):</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										'input_tokens': 'usage.prompt_tokens',
										'output_tokens': 'usage.completion_tokens'
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Anthropic/Claude (auto-detected):</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										'input_tokens': 'usage.input_tokens',
										'output_tokens': 'usage.output_tokens'
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Google Gemini (auto-detected):</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										'input_tokens': 'usageMetadata.promptTokenCount',
										'output_tokens': 'usageMetadata.candidatesTokenCount'
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Ollama (auto-detected):</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										'input_tokens': 'prompt_eval_count',
										'output_tokens': 'eval_count'
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for custom API with total tokens only:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										'total_tokens': 'metadata.tokens_used'
									}, null, 2)}
								</CodeSnippet>

								<h5 className={styles.subSectionHeading}>Headers</h5>
								<p className={styles.helpText}>Custom HTTP headers to send with the request to the API endpoint.</p>
								<ul className={styles.helpList}>
									<li className={styles.listItem}>Must be a valid JSON object with string values</li>
									<li className={styles.listItem}>Authentication headers will be automatically added if you provide an API Key</li>
								</ul>
								<h6 className={styles.exampleHeading}>Example:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({ 
										'Content-Type': 'application/json',
										'X-Custom-Header': 'custom-value'
									}, null, 2)}
								</CodeSnippet>
							</div>
						</AccordionItem>
					</Accordion>
				</Stack>
			</Form>
		</Modal>
	);
}
