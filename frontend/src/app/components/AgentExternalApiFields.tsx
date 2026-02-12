import type React from 'react';
import {
	Accordion,
	AccordionItem,
	Button,
	Checkbox,
	CodeSnippet,
	ComboBox,
	Dropdown,
	Stack,
	Tag,
	TextArea,
	TextInput
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/icons-react';
import { extractCapabilityName } from '../../lib/capabilities';
import styles from './AgentFormModal.module.scss';
import type { RequestTemplate, ResponseMap } from './AgentFormModal.types';

interface AgentExternalApiFieldsProps {
	formData: Record<string, string>;
	onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
	requestTemplates: RequestTemplate[];
	setRequestTemplates: React.Dispatch<React.SetStateAction<RequestTemplate[]>>;
	responseMaps: ResponseMap[];
	setResponseMaps: React.Dispatch<React.SetStateAction<ResponseMap[]>>;
	newTemplate: Partial<RequestTemplate>;
	setNewTemplate: React.Dispatch<React.SetStateAction<Partial<RequestTemplate>>>;
	newResponseMap: Partial<ResponseMap>;
	setNewResponseMap: React.Dispatch<React.SetStateAction<Partial<ResponseMap>>>;
	shouldShowNewTemplateForm: boolean;
	setShouldShowNewTemplateForm: React.Dispatch<React.SetStateAction<boolean>>;
	shouldShowNewMapForm: boolean;
	setShouldShowNewMapForm: React.Dispatch<React.SetStateAction<boolean>>;
	templateCapabilityNames: string[];
	responseMapCapabilityNames: string[];
	serializeCapabilitiesOrError: (raw: string | undefined) => string | undefined;
	setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function AgentExternalApiFields({
	formData,
	onInputChange,
	requestTemplates,
	setRequestTemplates,
	responseMaps,
	setResponseMaps,
	newTemplate,
	setNewTemplate,
	newResponseMap,
	setNewResponseMap,
	shouldShowNewTemplateForm,
	setShouldShowNewTemplateForm,
	shouldShowNewMapForm,
	setShouldShowNewMapForm,
	templateCapabilityNames,
	responseMapCapabilityNames,
	serializeCapabilitiesOrError,
	setError
}: AgentExternalApiFieldsProps) {
	return (
		<>
			<TextInput
				id="agent-api-endpoint"
				labelText="API Endpoint"
				placeholder="Enter API endpoint URL (e.g., https://api.example.com/v1/completion)"
				value={formData['agent-api-endpoint'] || ''}
				onChange={onInputChange}
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
					onInputChange(event);
				}}
				helperText="HTTP method to use for API requests (default: POST)"
			/>
			<TextInput
				id="agent-api-key"
				labelText="API Key (Optional)"
				placeholder="Enter API key for authentication"
				value={formData['agent-api-key'] || ''}
				onChange={onInputChange}
				type="password"
			/>
			<TextArea
				id="agent-token-mapping"
				labelText="Token mapping (Optional)"
				placeholder='JSON mapping to extract token usage, e.g.: {"input_tokens": "usage.prompt_tokens", "output_tokens": "usage.completion_tokens"}'
				rows={3}
				value={formData['agent-token-mapping'] || ''}
				onChange={onInputChange}
				helperText="Leave empty for auto-detection (works with OpenAI, Claude, Gemini, etc.) or specify custom mapping"
			/>
			<TextArea
				id="agent-headers"
				labelText="Headers (Optional)"
				placeholder='Enter custom headers as JSON, e.g.: {"Content-Type": "application/json", "X-Custom-Header": "value"}'
				rows={3}
				value={formData['agent-headers'] || ''}
				onChange={onInputChange}
				helperText="Custom HTTP headers as JSON object"
			/>

			<Accordion>
				<AccordionItem title="Request templates (recommended)" open>
					<div className={styles.templatesSection}>
						<p className={styles.sectionDescription}>
							Templates define how to format requests to your API. At least one template is needed to execute conversations.
						</p>

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

												const newTpl = {
													...newTemplate,
													capabilities: normalizedCaps || '',
													id: Date.now(),
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

				<AccordionItem title="Response maps (recommended)" open>
					<div className={styles.templatesSection}>
						<p className={styles.sectionDescription}>
							Response maps define how to extract data from API responses. At least one map is needed to execute conversations.
						</p>

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
												try {
													JSON.parse(newResponseMap.spec || '');
												} catch (err) {
													setError(`Invalid JSON in response map spec: ${err instanceof Error ? err.message : 'Unknown error'}`);
													return;
												}

												const normalizedCaps = serializeCapabilitiesOrError(newResponseMap.capabilities);

												const newMap = {
													...newResponseMap,
													capabilities: normalizedCaps || '',
													id: Date.now(),
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
	);
}
