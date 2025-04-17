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
		? {
			'agent-name': getAgentById(editingId)?.name || '',
			'agent-version': getAgentById(editingId)?.version || '',
			'agent-prompt': getAgentById(editingId)?.prompt || '',
			'agent-settings': getAgentById(editingId)?.settings || '',
		}
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
