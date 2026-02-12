import type React from 'react';
import { TextArea, TextInput } from '@carbon/react';

interface AgentCrewAIFieldsProps {
	formData: Record<string, string>;
	onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function AgentCrewAIFields({ formData, onInputChange }: AgentCrewAIFieldsProps) {
	return (
		<>
			<TextInput
				id="agent-role"
				labelText="Role"
				placeholder="Enter agent role (e.g., AI Assistant)"
				value={formData['agent-role'] || ''}
				onChange={onInputChange}
			/>
			<TextInput
				id="agent-goal"
				labelText="Goal"
				placeholder="Enter agent goal (e.g., Help the user with their tasks)"
				value={formData['agent-goal'] || ''}
				onChange={onInputChange}
			/>
			<TextArea
				id="agent-backstory"
				labelText="Backstory"
				placeholder="Enter agent backstory"
				rows={2}
				value={formData['agent-backstory'] || ''}
				onChange={onInputChange}
			/>
			<TextInput
				id="agent-model"
				labelText="Model Name"
				placeholder="Enter model name (e.g., llama3, mistral, etc.)"
				value={formData['agent-model'] || ''}
				onChange={onInputChange}
			/>
			<div style={{ display: 'flex', gap: '1rem' }}>
				<TextInput
					id="agent-temperature"
					labelText="Temperature"
					placeholder="0.7"
					value={formData['agent-temperature'] || ''}
					onChange={onInputChange}
					style={{ flex: 1 }}
				/>
				<TextInput
					id="agent-max-tokens"
					labelText="Max Tokens"
					placeholder="1000"
					value={formData['agent-max-tokens'] || ''}
					onChange={onInputChange}
					style={{ flex: 1 }}
				/>
			</div>
			<TextInput
				id="agent-ollama-url"
				labelText="Ollama Base URL"
				placeholder="Enter Ollama base URL (e.g., http://your-ollama-host:11434)"
				value={formData['agent-ollama-url'] || ''}
				onChange={onInputChange}
			/>
		</>
	);
}
