'use client';

import { useState } from 'react';
import styles from './page.module.scss';
import { useAppData } from '@/lib/AppDataContext';
import TestExecutor from './components/TestExecutor';
import JobsManager from './components/JobsManager';
import AppSideNav from './components/SideNav';
import Tests from './components/Tests';
import Agents from './components/Agents';
import Results from './components/Results';
import AgentFormModal from './components/AgentFormModal';
import TestFormModal from './components/TestFormModal';
import ResultViewModal from './components/ResultViewModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';

interface AgentSettings {
	type?: 'crew_ai' | 'external_api';
	base_url?: string;
	model?: string;
	role?: string;
	goal?: string;
	backstory?: string;
	temperature?: number;
	max_tokens?: number;
	// External API properties
	api_endpoint?: string;
	api_key?: string;
	request_template?: string;
	response_mapping?: string;
	headers?: Record<string, string>;
}

export default function Home() {
	const { fetchAllData, getAgentById, getTestById, getResultById } = useAppData();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalType, setModalType] = useState<'agent' | 'test' | 'result' | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [activeNav, setActiveNav] = useState<string>('tests');

	// Form state
	const [formData, setFormData] = useState<Record<string, string>>({});

	// Delete states
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [deleteType, setDeleteType] = useState<'agent' | 'test' | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [deleteName, setDeleteName] = useState('');

	// Form handling
	const handleAddClick = (type: 'agent' | 'test') => {
		setModalType(type);
		setFormData({});
		setEditingId(null);
		setIsModalOpen(true);
	};

	const handleEditAgent = (agentId: number) => {
		const agent = getAgentById(agentId);
		if (!agent) return;

		setModalType('agent');
		setEditingId(agentId);

		// Parse settings to extract individual fields
		let settings: AgentSettings = {};
		try {
			settings = JSON.parse(agent.settings);
		} catch (e) {
			console.error('Error parsing agent settings:', e);
		}

		const formEntries: Record<string, string> = {
			'agent-name': agent.name || '',
			'agent-version': agent.version || '',
			'agent-prompt': agent.prompt || '',
			'agent-settings': agent.settings || '',
			'agent-type': settings.type || 'crew_ai',
		};

		// Add CrewAI specific settings
		if (settings.type !== 'external_api') {
			formEntries['agent-role'] = settings.role || '';
			formEntries['agent-goal'] = settings.goal || '';
			formEntries['agent-backstory'] = settings.backstory || '';
			formEntries['agent-model'] = settings.model || '';
			formEntries['agent-temperature'] = settings.temperature?.toString() || '';
			formEntries['agent-max-tokens'] = settings.max_tokens?.toString() || '';
			formEntries['agent-ollama-url'] = settings.base_url || '';
		} else {
			// External API settings
			formEntries['agent-api-endpoint'] = settings.api_endpoint || '';
			formEntries['agent-api-key'] = settings.api_key || '';
			formEntries['agent-request-template'] = settings.request_template || '';
			formEntries['agent-response-mapping'] = settings.response_mapping || '';
			formEntries['agent-headers'] = settings.headers ? JSON.stringify(settings.headers, null, 2) : '';
		}

		setFormData(formEntries);
		setIsModalOpen(true);
	};

	const handleEditTest = (testId: number) => {
		const test = getTestById(testId);
		if (!test) return;

		setModalType('test');
		setEditingId(testId);

		setFormData({
			'test-name': test.name || '',
			'test-description': test.description || '',
			'test-input': test.input || '',
			'test-expected-output': test.expected_output || '',
		});

		setIsModalOpen(true);
	};

	const handleViewResult = (resultId: number) => {
		const result = getResultById(resultId);
		if (result && result.id !== undefined) {
			setEditingId(result.id);
			setModalType('result');
			setIsModalOpen(true);
		}
	};

	const handleDeleteAgent = async (agentId: number) => {
		const agent = getAgentById(agentId);
		if (!agent) return;
		
		setDeleteType('agent');
		setDeleteId(agentId);
		setDeleteName(agent.name);
		setIsDeleteModalOpen(true);
	};

	const handleDeleteTest = async (testId: number) => {
		const test = getTestById(testId);
		if (!test) return;
		
		setDeleteType('test');
		setDeleteId(testId);
		setDeleteName(test.name);
		setIsDeleteModalOpen(true);
	};

	return (
		<main className={styles.main}>
			<AppSideNav activeItem={activeNav} onNavChange={setActiveNav} />
			
			<div className={styles.contentContainer}>
				<div className={styles.content}>
					{activeNav === 'tests' && (
						<Tests
							onAddClick={() => handleAddClick('test')}
							onEditTest={handleEditTest}
							onDeleteTest={handleDeleteTest}
						/>
					)}

					{activeNav === 'agents' && (
						<Agents
							onAddClick={() => handleAddClick('agent')}
							onEditAgent={handleEditAgent}
							onDeleteAgent={handleDeleteAgent}
						/>
					)}

					{activeNav === 'results' && (
						<Results
							onViewResult={handleViewResult}
							onAddTestClick={() => handleAddClick('test')}
						/>
					)}

					{activeNav === 'jobs' && (
						<JobsManager 
							onRefresh={fetchAllData} 
							onResultView={handleViewResult} 
						/>
					)}

					{activeNav === 'run' && (
						<TestExecutor 
							onJobCreated={fetchAllData} 
						/>
					)}
				</div>
			</div>

			{/* Add/Edit Modal */}
			<AgentFormModal
				isOpen={isModalOpen && modalType === 'agent'}
				onClose={() => {
					setIsModalOpen(false);
					setError(null);
					setEditingId(null);
				}}
				onSuccess={fetchAllData}
				formData={formData}
				editingId={editingId}
			/>
			{/* Test Modal */}
			<TestFormModal
				isOpen={isModalOpen && modalType === 'test'}
				onClose={() => {
					setIsModalOpen(false);
					setError(null);
					setEditingId(null);
				}}
				onSuccess={fetchAllData}
				initialData={formData}
				editingId={editingId}
			/>

			{/* Result Modal */}
			<ResultViewModal
				isOpen={isModalOpen && modalType === 'result'}
				onClose={() => {
					setIsModalOpen(false);
					setModalType(null);
					setEditingId(null);
					setError(null);
				}}
				result={editingId ? getResultById(editingId) || null : null}
				error={error}
			/>

			{/* Delete confirmation modal */}
			<DeleteConfirmationModal
				isOpen={isDeleteModalOpen}
				onClose={() => {
					setIsDeleteModalOpen(false);
					setDeleteType(null);
					setDeleteId(null);
					setDeleteName('');
					setError(null);
				}}
				onSuccess={fetchAllData}
				deleteType={deleteType}
				deleteName={deleteName}
				deleteId={deleteId}
			/>
		</main>
	);
}
