'use client';

import React, { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import Agents from '../components/Agents';
import AgentFormModal from '../components/AgentFormModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

export default function AgentsPage() {
	const { fetchAllData, getAgentById } = useAppData();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [deleteName, setDeleteName] = useState('');

	const handleAddClick = () => {
		setEditingId(null);
		setIsModalOpen(true);
	};

	const handleEditAgent = (id: number) => {
		const agent = getAgentById(id);
		if (!agent) return;
		setEditingId(id);
		setIsModalOpen(true);
	};

	const handleDeleteAgent = (id: number) => {
		const agent = getAgentById(id);
		if (!agent) return;
		setDeleteId(id);
		setDeleteName(agent.name);
		setIsDeleteModalOpen(true);
	};

	const initialFormData: Record<string, string> = editingId
		? (() => {
			const agent = getAgentById(editingId);
			if (!agent) return {} as Record<string, string>;

			// Start with top-level fields
			const data: Record<string, string> = {
				'agent-name': agent.name || '',
				'agent-version': agent.version || '',
				'agent-prompt': agent.prompt || '',
				'agent-settings': agent.settings || '',
			};

			// Parse settings JSON and map to form fields
			try {
				const settings = agent.settings ? JSON.parse(agent.settings) : {};
				if (settings.type) data['agent-type'] = settings.type;

				// CrewAI fields
				if (settings.type === 'crew_ai' || settings.type === 'crewai') {
					data['agent-model'] = settings.model ?? data['agent-model'];
					data['agent-temperature'] = settings.temperature?.toString() ?? '';
					data['agent-max-tokens'] = settings.max_tokens?.toString() ?? '';
					data['agent-ollama-url'] = settings.base_url ?? '';
					data['agent-role'] = settings.role ?? '';
					data['agent-goal'] = settings.goal ?? '';
					data['agent-backstory'] = settings.backstory ?? '';
				}

				// External API fields
				if (settings.type === 'external_api') {
					data['agent-api-endpoint'] = settings.api_endpoint ?? '';
					data['agent-api-key'] = settings.api_key ?? '';
					data['agent-request-template'] = settings.request_template ?? '';
					if (settings.response_mapping !== undefined) {
						data['agent-response-mapping'] = typeof settings.response_mapping === 'string'
							? settings.response_mapping
							: JSON.stringify(settings.response_mapping);
					}
					if (settings.headers !== undefined) {
						data['agent-headers'] = typeof settings.headers === 'string'
							? settings.headers
							: JSON.stringify(settings.headers);
					}
				}
			} catch {
				// If settings are invalid, ignore and use defaults
			}

			return data;
		})()
		: ({} as Record<string, string>);

	return (
		<>
			<Agents
				onAddClick={handleAddClick}
				onEditAgent={handleEditAgent}
				onDeleteAgent={handleDeleteAgent}
			/>

			<AgentFormModal
				isOpen={isModalOpen}
				editingId={editingId}
				formData={initialFormData}
				onClose={() => setIsModalOpen(false)}
				onSuccess={() => {
					fetchAllData();
					setIsModalOpen(false);
				}}
			/>

			<DeleteConfirmationModal
				isOpen={isDeleteModalOpen}
				deleteType="agent"
				deleteName={deleteName}
				deleteId={deleteId}
				onClose={() => setIsDeleteModalOpen(false)}
				onSuccess={() => {
					fetchAllData();
					setIsDeleteModalOpen(false);
				}}
			/>
		</>
	);
}
