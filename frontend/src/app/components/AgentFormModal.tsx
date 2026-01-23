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
	Dropdown,
	Tag,
	Checkbox,
	ComboBox
} from '@carbon/react';
import { Launch, TrashCan, Edit, Add } from '@carbon/icons-react';
import { api } from '@/lib/api';
import { extractCapabilityName, capabilityNameToJson } from '../../lib/capabilities';
import styles from './AgentFormModal.module.scss';

interface AgentFormModalProps {
	isOpen: boolean;
	editingId?: number | null;
	formData: Record<string, string>;
	onClose: () => void;
	onSuccess: () => void;
}

interface RequestTemplate {
	id?: number;
	name: string;
	description?: string;
	body: string;
	is_default?: boolean;
	capabilities?: string;
	_isNew?: boolean;
	_isEditing?: boolean;
	_isDeleted?: boolean;
}

interface ResponseMap {
	id?: number;
	name: string;
	description?: string;
	spec: string;
	is_default?: boolean;
	capabilities?: string;
	_isNew?: boolean;
	_isEditing?: boolean;
	_isDeleted?: boolean;
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
				} catch (err) {
					console.error('Failed to load templates/maps:', err);
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
			} catch (error) {
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
					console.warn('External API agent saved without templates/maps - will need them before execution');
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

							{/* Request Templates Section */}
							<Accordion>
								<AccordionItem title="Request templates (recommended)" open>
									<div className={styles.templatesSection}>
										<p className={styles.sectionDescription}>
											Templates define how to format requests to your API. At least one template is needed to execute conversations.
										</p>

										{/* Existing templates */}
										{requestTemplates.filter(t => !t._isDeleted).map((template, idx) => (
											<div key={template.id || `new-${idx}`} className={styles.templateItem}>
												<div className={styles.templateHeader}>
													<div className={styles.templateTitle}>
														<strong>{template.name}</strong>
														{template.is_default && <Tag type="green" size="sm">default</Tag>}
													</div>
													<div className={styles.templateActions}>
														<Button
															kind="ghost"
															size="sm"
															renderIcon={Edit}
															onClick={() => {
																setRequestTemplates(requestTemplates.map(t =>
																	t.id === template.id ? { ...t, _isEditing: !t._isEditing } : t
																));
															}}
														>
															{template._isEditing ? 'Cancel' : 'Edit'}
														</Button>
														<Button
															kind="danger--ghost"
															size="sm"
															renderIcon={TrashCan}
															onClick={() => {
																setRequestTemplates(requestTemplates.map(t =>
																	t.id === template.id ? { ...t, _isDeleted: true } : t
																));
															}}
														>
															Delete
														</Button>
													</div>
												</div>
												{template._isEditing ? (
													<Stack gap={4}>
														<TextInput
															id={`template-name-${idx}`}
															labelText="Name"
															value={template.name}
															onChange={(e) => {
																setRequestTemplates(requestTemplates.map(t =>
																	t.id === template.id ? { ...t, name: e.target.value } : t
																));
															}}
														/>
														<TextArea
															id={`template-body-${idx}`}
															labelText="Body (JSON)"
															value={template.body}
															onChange={(e) => {
																setRequestTemplates(requestTemplates.map(t =>
																	t.id === template.id ? { ...t, body: e.target.value } : t
																));
															}}
															rows={4}
														/>
														<ComboBox
															id={`template-capabilities-${idx}`}
															titleText="Capability"
															placeholder="Select or type a capability name"
															items={templateCapabilityNames}
															selectedItem={extractCapabilityName(template.capabilities)}
															onChange={(e) => {
																setRequestTemplates(requestTemplates.map(t =>
																	t.id === template.id ? { ...t, capabilities: e.selectedItem || '' } : t
																));
															}}
															allowCustomValue
															helperText="Tag this template with a capability name for matching"
														/>
														<Checkbox
															id={`template-default-${idx}`}
															labelText="Set as default"
															checked={!!template.is_default}
															onChange={(_evt, { checked }) => {
																setRequestTemplates(requestTemplates.map(t =>
																	t.id === template.id ? { ...t, is_default: checked } : { ...t, is_default: false }
																));
															}}
														/>
													</Stack>
												) : (
													<CodeSnippet type="multi" feedback="Copied to clipboard">
														{template.body}
													</CodeSnippet>
												)}
											</div>
										))}

										{/* Add new template button */}
										{!shouldShowNewTemplateForm && (
											<Button
												kind="tertiary"
												size="sm"
												renderIcon={Add}
												data-testid="open-template-form"
												onClick={() => setShouldShowNewTemplateForm(true)}
											>
												Add new template
											</Button>
										)}

										{/* New template form */}
										{shouldShowNewTemplateForm && (
											<div className={styles.newTemplateForm}>
												<h6 className={styles.newFormTitle}>Add new template</h6>
												<Stack gap={4}>
													<TextInput
														id="new-template-name"
														labelText="Name"
														value={newTemplate.name || ''}
														onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
														placeholder="e.g., default, openai-style"
													/>
													<TextArea
														id="new-template-body"
														labelText="Body (JSON)"
														value={newTemplate.body || ''}
														onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
														placeholder='{"model": "gpt-4", "messages": [{"role": "user", "content": "{{input}}"}]}'
														rows={4}
													/>
													<ComboBox
														id="new-template-capabilities"
														titleText="Capability"
														placeholder="Select or type a capability name"
														items={templateCapabilityNames}
														selectedItem={extractCapabilityName(newTemplate.capabilities)}
														onChange={(e) => setNewTemplate({ ...newTemplate, capabilities: e.selectedItem || '' })}
														allowCustomValue
														helperText="Tag this template with a capability name (e.g., openai-chat, ollama-generate)"
													/>
													<Checkbox
														id="new-template-default"
														labelText="Set as default"
														checked={!!newTemplate.is_default}
														onChange={(_evt, { checked }) => setNewTemplate({ ...newTemplate, is_default: checked })}
													/>
													<div className={styles.formActions}>
														<Button
															kind="secondary"
															size="sm"
															onClick={() => {
																setShouldShowNewTemplateForm(false);
																setNewTemplate({ name: '', body: '', capabilities: '', is_default: false });
															}}
														>
															Cancel
														</Button>
														<Button
															kind="primary"
															size="sm"
															onClick={() => {
																try {
																	JSON.parse(newTemplate.body || '');
																} catch (err) {
																	setError(`Invalid JSON in template body: ${err instanceof Error ? err.message : 'Unknown error'}`);
																	return;
																}

																const normalizedCaps = serializeCapabilitiesOrError(newTemplate.capabilities);
																// null is valid - means no capability set

																// Mark as new for saving later
																const newTpl = {
																	...newTemplate,
																	capabilities: normalizedCaps || '',
																	id: Date.now(), // temporary ID
																	_isNew: true
																} as RequestTemplate & { _isNew: boolean };
																setRequestTemplates([...requestTemplates, newTpl]);
																setShouldShowNewTemplateForm(false);
																setNewTemplate({ name: '', body: '', capabilities: '', is_default: false });
																setError(null);
															}}
															disabled={!newTemplate.name || !newTemplate.body}
														>
															Add
														</Button>
													</div>
												</Stack>
											</div>
										)}
									</div>
								</AccordionItem>

								{/* Response Maps Section */}
								<AccordionItem title="Response maps (recommended)" open>
									<div className={styles.templatesSection}>
										<p className={styles.sectionDescription}>
											Response maps define how to extract data from API responses. At least one map is needed to execute conversations.
										</p>

										{/* Existing maps */}
										{responseMaps.filter(m => !m._isDeleted).map((map, idx) => (
											<div key={map.id || `new-${idx}`} className={styles.mapItem}>
												<div className={styles.mapHeader}>
													<div className={styles.mapTitle}>
														<strong>{map.name}</strong>
														{map.is_default && <Tag type="green" size="sm">default</Tag>}
													</div>
													<div className={styles.mapActions}>
														<Button
															kind="ghost"
															size="sm"
															renderIcon={Edit}
															onClick={() => {
																setResponseMaps(responseMaps.map(m =>
																	m.id === map.id ? { ...m, _isEditing: !m._isEditing } : m
																));
															}}
														>
															{map._isEditing ? 'Cancel' : 'Edit'}
														</Button>
														<Button
															kind="danger--ghost"
															size="sm"
															renderIcon={TrashCan}
															onClick={() => {
																setResponseMaps(responseMaps.map(m =>
																	m.id === map.id ? { ...m, _isDeleted: true } : m
																));
															}}
														>
															Delete
														</Button>
													</div>
												</div>
												{map._isEditing ? (
													<Stack gap={4}>
														<TextInput
															id={`map-name-${idx}`}
															labelText="Name"
															value={map.name}
															onChange={(e) => {
																setResponseMaps(responseMaps.map(m =>
																	m.id === map.id ? { ...m, name: e.target.value } : m
																));
															}}
														/>
														<TextArea
															id={`map-spec-${idx}`}
															labelText="Spec (JSON)"
															value={map.spec}
															onChange={(e) => {
																setResponseMaps(responseMaps.map(m =>
																	m.id === map.id ? { ...m, spec: e.target.value } : m
																));
															}}
															rows={4}
														/>
														<ComboBox
															id={`map-capabilities-${idx}`}
															titleText="Capability"
															placeholder="Select or type a capability name"
															items={responseMapCapabilityNames}
															selectedItem={extractCapabilityName(map.capabilities)}
															onChange={(e) => {
																setResponseMaps(responseMaps.map(m =>
																	m.id === map.id ? { ...m, capabilities: e.selectedItem || '' } : m
																));
															}}
															allowCustomValue
															helperText="Tag this response map with a capability name for matching"
														/>
														<Checkbox
															id={`map-default-${idx}`}
															labelText="Set as default"
															checked={!!map.is_default}
															onChange={(_evt, { checked }) => {
																setResponseMaps(responseMaps.map(m =>
																	m.id === map.id ? { ...m, is_default: checked } : { ...m, is_default: false }
																));
															}}
														/>
													</Stack>
												) : (
													<CodeSnippet type="multi" feedback="Copied to clipboard">
														{map.spec}
													</CodeSnippet>
												)}
											</div>
										))}

										{/* Add new map button */}
										{!shouldShowNewMapForm && (
											<Button
												kind="tertiary"
												size="sm"
												renderIcon={Add}
												onClick={() => setShouldShowNewMapForm(true)}
											>
												Add new response map
											</Button>
										)}

										{/* New map form */}
										{shouldShowNewMapForm && (
											<div className={styles.newMapForm}>
												<h6 className={styles.newFormTitle}>Add new response map</h6>
												<Stack gap={4}>
													<TextInput
														id="new-map-name"
														labelText="Name"
														value={newResponseMap.name || ''}
														onChange={(e) => setNewResponseMap({ ...newResponseMap, name: e.target.value })}
														placeholder="e.g., default, openai-style"
													/>
													<TextArea
														id="new-map-spec"
														labelText="Spec (JSON)"
														value={newResponseMap.spec || ''}
														onChange={(e) => setNewResponseMap({ ...newResponseMap, spec: e.target.value })}
														placeholder='{"output": "choices.0.message.content"}'
														rows={4}
													/>
													<ComboBox
														id="new-map-capabilities"
														titleText="Capability"
														placeholder="Select or type a capability name"
														items={responseMapCapabilityNames}
														selectedItem={extractCapabilityName(newResponseMap.capabilities)}
														onChange={(e) => setNewResponseMap({ ...newResponseMap, capabilities: e.selectedItem || '' })}
														allowCustomValue
														helperText="Tag this response map with a capability name (e.g., openai-chat, ollama-generate)"
													/>
													<Checkbox
														id="new-map-default"
														labelText="Set as default"
														checked={!!newResponseMap.is_default}
														onChange={(_evt, { checked }) => setNewResponseMap({ ...newResponseMap, is_default: checked })}
													/>
													<div className={styles.formActions}>
														<Button
															kind="secondary"
															size="sm"
															onClick={() => {
																setShouldShowNewMapForm(false);
																setNewResponseMap({ name: '', spec: '', capabilities: '', is_default: false });
															}}
														>
															Cancel
														</Button>
														<Button
															kind="primary"
															size="sm"
															onClick={() => {
																// Validate JSON
																try {
																	JSON.parse(newResponseMap.spec || '');
																} catch (err) {
																	setError(`Invalid JSON in response map spec: ${err instanceof Error ? err.message : 'Unknown error'}`);
																	return;
																}

																const normalizedCaps = serializeCapabilitiesOrError(newResponseMap.capabilities);
																// null is valid - means no capability set

																// Mark as new for saving later
																const newMap = {
																	...newResponseMap,
																	capabilities: normalizedCaps || '',
																	id: Date.now(), // temporary ID
																	_isNew: true
																} as ResponseMap & { _isNew: boolean };
																setResponseMaps([...responseMaps, newMap]);
																setShouldShowNewMapForm(false);
																setNewResponseMap({ name: '', spec: '', capabilities: '', is_default: false });
																setError(null);
															}}
															disabled={!newResponseMap.name || !newResponseMap.spec}
														>
															Add
														</Button>
													</div>
												</Stack>
											</div>
										)}
									</div>
								</AccordionItem>
							</Accordion>
						</>
					)}

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
