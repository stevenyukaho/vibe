import { useState, useEffect } from 'react';
import {
	Modal,
	TextArea,
	Form,
	Stack,
	InlineNotification,
	Accordion,
	AccordionItem,
	CodeSnippet
} from '@carbon/react';
import { api } from '@/lib/api';
import { capabilityNameToJson } from '../../lib/capabilities';
import { AgentCoreFields } from './AgentCoreFields';
import { AgentCrewAIFields } from './AgentCrewAIFields';
import { AgentExternalApiFields } from './AgentExternalApiFields';
import { TestConnectionButton } from './TestConnectionButton';
import type {
	RequestTemplate,
	ResponseMap,
	TestConnectionStatus
} from './AgentFormModal.types';
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

	// State for templates and maps
const [requestTemplates, setRequestTemplates] = useState<RequestTemplate[]>([]);
const [responseMaps, setResponseMaps] = useState<ResponseMap[]>([]);
const [newTemplate, setNewTemplate] = useState<Partial<RequestTemplate>>({ name: '', body: '', capabilities: '', is_default: false });
const [newResponseMap, setNewResponseMap] = useState<Partial<ResponseMap>>({ name: '', spec: '', capabilities: '', is_default: false });
	const [shouldShowNewTemplateForm, setShouldShowNewTemplateForm] = useState(false);
	const [shouldShowNewMapForm, setShouldShowNewMapForm] = useState(false);

	// Capability name suggestions for auto-complete
	const [templateCapabilityNames, setTemplateCapabilityNames] = useState<string[]>([]);
	const [responseMapCapabilityNames, setResponseMapCapabilityNames] = useState<string[]>([]);

	useEffect(() => {
		if (isOpen) {
			api.getRequestTemplateCapabilityNames().then(setTemplateCapabilityNames);
			api.getResponseMapCapabilityNames().then(setResponseMapCapabilityNames);
		}
	}, [isOpen]);

	// Update form data when initialFormData changes
	useEffect(() => {
		if (isOpen && initialFormData) {
			setFormData(initialFormData);
		}
	}, [isOpen, initialFormData]);

	// Load templates and maps when editing an existing agent
	useEffect(() => {
		if (isOpen && editingId) {
			const loadTemplatesAndMaps = async () => {
				try {
					const [templates, maps] = await Promise.all([
						api.getAgentRequestTemplates(editingId),
						api.getAgentResponseMaps(editingId)
					]);
					// Convert is_default from number (0/1) to boolean
					setRequestTemplates((templates || []).map(t => ({
						...t,
						is_default: Number(t.is_default) === 1,
						capabilities: typeof t.capabilities === 'string'
							? t.capabilities
							: t.capabilities
								? JSON.stringify(t.capabilities)
								: ''
					})));
					setResponseMaps((maps || []).map(m => ({
						...m,
						is_default: Number(m.is_default) === 1,
						capabilities: typeof m.capabilities === 'string'
							? m.capabilities
							: m.capabilities
								? JSON.stringify(m.capabilities)
								: ''
					})));
				} catch {
					// Best-effort: templates/maps are optional for editing UI
					setRequestTemplates([]);
					setResponseMaps([]);
				}
			};
			loadTemplatesAndMaps();
		} else if (isOpen) {
			// Reset for new agent
			setRequestTemplates([]);
			setResponseMaps([]);
			setNewTemplate({ name: '', body: '', capabilities: '', is_default: false });
			setNewResponseMap({ name: '', spec: '', capabilities: '', is_default: false });
			setShouldShowNewTemplateForm(false);
			setShouldShowNewMapForm(false);
		}
	}, [isOpen, editingId]);

	// State for API connection testing
	const [testConnectionStatus, setTestConnectionStatus] = useState<TestConnectionStatus | null>(null);

	// Form input change handler
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setFormData({
			...formData,
			[e.target.id]: e.target.value
		});
	};

	/**
	 * Converts a capability name (plain string) to JSON format for storage.
	 * Returns undefined if no capability is set.
	 */
	const serializeCapabilitiesOrError = (raw: string | undefined): string | undefined => {
		// With the simplified model, capabilities is just a name string
		// We convert it to JSON: {"name": "..."} for storage
		return capabilityNameToJson(raw || null) ?? undefined;
	};

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
			} catch {
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
				} catch {
					setError('Invalid API Endpoint URL format');
					setIsSaving(false);
					return;
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
					} catch {
						setError('Invalid headers JSON');
						setIsSaving(false);
						return;
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

				// Add token mapping if provided
				if (formData['agent-token-mapping'] !== undefined) {
					if (formData['agent-token-mapping']) {
						try {
							JSON.parse(formData['agent-token-mapping']);
							settings = {
								...settings,
								token_mapping: formData['agent-token-mapping']
							};
						} catch {
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
					} catch {
						setError('Invalid headers JSON');
						setIsSaving(false);
						return;
					}
				}
			}

			const agentData = {
				name: formData['agent-name'],
				version: formData['agent-version'],
				prompt: formData['agent-prompt'],
				settings: JSON.stringify(settings)
			};

			let savedAgentId: number;
			if (editingId) {
				// Update existing agent
				await api.updateAgent(editingId, agentData);
				savedAgentId = editingId;
			} else {
				// Create new agent
				const createdAgent = await api.createAgent(agentData);
				savedAgentId = createdAgent.id!;
			}

			// For external API agents, save templates and maps
			if (settings.type === 'external_api') {
				// Warn if no templates/maps but allow saving
				const activeTemplates = requestTemplates.filter(t => !t._isDeleted);
				const activeMaps = responseMaps.filter(m => !m._isDeleted);

				if (activeTemplates.length === 0 || activeMaps.length === 0) {
					// Best-effort: allow saving, but execution will require templates/maps
				}

				// Process templates
				for (const template of requestTemplates) {
					if (template._isDeleted && template.id && !template._isNew) {
						await api.deleteAgentRequestTemplate(savedAgentId, template.id);
					} else if (template._isNew && !template._isDeleted) {
						// Create new template
						try {
							JSON.parse(template.body);
							const capabilitiesPayload = serializeCapabilitiesOrError(template.capabilities);
							// null is valid - means no capability set
							await api.createAgentRequestTemplate(savedAgentId, {
								name: template.name,
								description: template.description,
								body: template.body,
								capabilities: capabilitiesPayload,
								is_default: template.is_default
							});
						} catch (err) {
							setError(`Invalid JSON in template "${template.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
							setIsSaving(false);
							return;
						}
					} else if (template.id && !template._isNew && !template._isDeleted) {
						// Update existing template
						try {
							JSON.parse(template.body);
							const capabilitiesPayload = serializeCapabilitiesOrError(template.capabilities);
							// null is valid - means no capability set
							await api.updateAgentRequestTemplate(savedAgentId, template.id, {
								name: template.name,
								description: template.description,
								body: template.body,
								capabilities: capabilitiesPayload,
								is_default: template.is_default
							});
						} catch (err) {
							setError(`Invalid JSON in template "${template.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
							setIsSaving(false);
							return;
						}
					}
				}

				// Process response maps
				for (const map of responseMaps) {
					if (map._isDeleted && map.id && !map._isNew) {
						await api.deleteAgentResponseMap(savedAgentId, map.id);
					} else if (map._isNew && !map._isDeleted) {
						// Create new map
						try {
							JSON.parse(map.spec);
							const capabilitiesPayload = serializeCapabilitiesOrError(map.capabilities);
							// null is valid - means no capability set
							await api.createAgentResponseMap(savedAgentId, {
								name: map.name,
								description: map.description,
								spec: map.spec,
								capabilities: capabilitiesPayload,
								is_default: map.is_default
							});
						} catch (err) {
							setError(`Invalid JSON in response map "${map.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
							setIsSaving(false);
							return;
						}
					} else if (map.id && !map._isNew && !map._isDeleted) {
						// Update existing map
						try {
							JSON.parse(map.spec);
							const capabilitiesPayload = serializeCapabilitiesOrError(map.capabilities);
							// null is valid - means no capability set
							await api.updateAgentResponseMap(savedAgentId, map.id, {
								name: map.name,
								description: map.description,
								spec: map.spec,
								capabilities: capabilitiesPayload,
								is_default: map.is_default
							});
						} catch (err) {
							setError(`Invalid JSON in response map "${map.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
							setIsSaving(false);
							return;
						}
					}
				}
			}

			// Notify parent of success and close modal
			onSuccess();
			onClose();
		} catch (error) {
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
			} catch {
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
				} catch {
					setTestConnectionStatus({
						loading: false,
						success: false,
						message: 'Invalid headers JSON'
					});
					return;
				}
			}

			// Prepare request body
			const body = { test: 'connection' };

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
					<AgentCoreFields
						formData={formData}
						onInputChange={handleInputChange}
					/>

					{(formData['agent-type'] !== 'external_api') ? (
						<AgentCrewAIFields
							formData={formData}
							onInputChange={handleInputChange}
						/>
					) : (
						<AgentExternalApiFields
							formData={formData}
							onInputChange={handleInputChange}
							requestTemplates={requestTemplates}
							setRequestTemplates={setRequestTemplates}
							responseMaps={responseMaps}
							setResponseMaps={setResponseMaps}
							newTemplate={newTemplate}
							setNewTemplate={setNewTemplate}
							newResponseMap={newResponseMap}
							setNewResponseMap={setNewResponseMap}
							shouldShowNewTemplateForm={shouldShowNewTemplateForm}
							setShouldShowNewTemplateForm={setShouldShowNewTemplateForm}
							shouldShowNewMapForm={shouldShowNewMapForm}
							setShouldShowNewMapForm={setShouldShowNewMapForm}
							templateCapabilityNames={templateCapabilityNames}
							responseMapCapabilityNames={responseMapCapabilityNames}
							serializeCapabilitiesOrError={serializeCapabilitiesOrError}
							setError={setError}
						/>
					)}

					<TestConnectionButton
						status={testConnectionStatus}
						onTestConnection={testApiConnection}
						disabled={!formData['agent-api-endpoint']}
					/>

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
								<p className={styles.helpText}>The request template formats your test input for the external API. It should be a valid JSON string with placeholders for where the conversation content should go.</p>
								<ul className={styles.helpList}>
									<li className={styles.listItem}>Must include <code>{'{{input}}'}</code> (required)</li>
									<li className={styles.listItem}><code>{'{{input}}'}</code> = current user message for this turn</li>
									<li className={styles.listItem}><code>{'{{conversation_history}}'}</code> = full transcript so far including roles (System/User/Assistant) and the current user message</li>
									<li className={styles.listItem}>If <code>{'{{conversation_history}}'}</code> is omitted, then <code>{'{{input}}'}</code> will contain the entire conversation so far (history-first mode)</li>
									<li className={styles.listItem}>If <code>{'{{conversation_history}}'}</code> is present, then <code>{'{{input}}'}</code> will contain only the current user message (dual-placeholder mode)</li>
								</ul>
								<h6 className={styles.exampleHeading}>History-first mode (no {'{{conversation_history}}'})</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({
										model: 'gpt-4',
										messages: [
											{ role: 'user', content: '{{input}}' } // {{input}} will be the entire conversation so far
										]
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Dual-placeholder mode (explicit history + current turn)</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({
										model: 'gpt-4',
										messages: [
											{ role: 'system', content: 'Follow instructions carefully.' },
											{ role: 'user', content: '{{input}}' },
											{ role: 'system', content: 'Conversation so far:\n{{conversation_history}}' }
										]
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for OpenAI:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({
										model: 'gpt-5',
										messages: [
											{ role: 'user', content: '{{input}}' }
										]
									}, null, 2)}
								</CodeSnippet>

								<h6 className={styles.exampleHeading}>Example for Anthropic/Claude:</h6>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{JSON.stringify({
										model: 'claude-sonnet-4.5',
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
