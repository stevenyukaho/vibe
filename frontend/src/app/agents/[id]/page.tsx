'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
	Button,
	InlineLoading,
	InlineNotification,
	Tile,
	Tag,
	CodeSnippet,
	Accordion,
	AccordionItem
} from '@carbon/react';
import {
	Edit,
	ArrowLeft
} from '@carbon/icons-react';
import { api, Agent, ExecutionSession, SessionMessage } from '../../../lib/api';
import { agentToFormData, loadConversationsByIds, loadSessionMessages, calculateSessionStats } from '../../../lib/utils';
import AgentFormModal from '../../components/AgentFormModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import SessionsTable from '../../components/SessionsTable';
import styles from './page.module.scss';

export default function AgentDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const [agent, setAgent] = useState<Agent | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [recentSessions, setRecentSessions] = useState<ExecutionSession[]>([]);
	const [conversations, setConversations] = useState<Map<number, { name: string; id: number }>>(new Map());
	const [sessionMessages, setSessionMessages] = useState<Map<number, SessionMessage[]>>(new Map());
	const [stats, setStats] = useState({
		totalRuns: 0,
		successRate: 0,
		avgExecutionTime: 0,
		lastRun: null as string | null
	});

	const load = async () => {
		try {
			setLoading(true);
			const id = Number(params.id);
			const agentData = await api.getAgentById(id);
			setAgent(agentData);

			// Load recent sessions for this agent (limited to 10 for display)
			const recentSessionsData = await api.getExecutionSessions({ agent_id: id, limit: 10, offset: 0 });
			setRecentSessions(recentSessionsData.data);

			// Load conversations for the sessions
			const conversationIds = Array.from(new Set(recentSessionsData.data.map(s => s.conversation_id).filter(id => id !== undefined) as number[]));
			const conversationsMap = await loadConversationsByIds(conversationIds);
			setConversations(conversationsMap);

			// Load session messages for accurate status and similarity score calculation
			const messagesMap = await loadSessionMessages(recentSessionsData.data);
			setSessionMessages(messagesMap);

			// Load all sessions for stats calculation
			const allSessionsData = await api.getExecutionSessions({ agent_id: id, limit: 1000, offset: 0 });

			// Calculate stats from all sessions
			const calculatedStats = calculateSessionStats(allSessionsData.data);
			setStats({
				totalRuns: allSessionsData.total,
				successRate: calculatedStats.successRate,
				avgExecutionTime: calculatedStats.avgDuration * 1000, // Convert back to ms for consistency
				lastRun: calculatedStats.lastRun
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load agent');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [params.id]);

	const handleEditClick = () => {
		setEditModalOpen(true);
	};

	const handleDeleteClick = () => {
		setDeleteModalOpen(true);
	};

	const handleBackClick = () => {
		router.push('/agents');
	};

	const initialFormData = agentToFormData(agent);

	if (loading) {
		return (
			<div className={styles.container}>
				<InlineLoading description="Loading agent..." />
			</div>
		);
	}

	if (error || !agent) {
		return (
			<div className={styles.container}>
				<InlineNotification
					kind="error"
					title="Error"
					subtitle={error || 'Agent not found'}
					hideCloseButton
				/>
				<Button onClick={handleBackClick} renderIcon={ArrowLeft}>
					Back to agents
				</Button>
			</div>
		);
	}

	const settings = agent.settings ? JSON.parse(agent.settings) : {};
	const agentType = settings.type || 'crew_ai';

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<Button
					kind="ghost"
					renderIcon={ArrowLeft}
					onClick={handleBackClick}
					className={styles.backButton}
				>
					Back to agents
				</Button>
				<div className={styles.headerActions}>
					<Button
						kind="ghost"
						renderIcon={Edit}
						onClick={handleEditClick}
					>
						Edit
					</Button>
					<Button
						kind="danger--ghost"
						onClick={handleDeleteClick}
					>
						Delete
					</Button>
				</div>
			</div>

			<div className={styles.content}>
				<div className={styles.mainInfo}>
					<h1 className={styles.title}>{agent.name}</h1>
					<div className={styles.meta}>
						<Tag type="blue" size="sm">Version {agent.version}</Tag>
						<Tag type={agentType === 'external_api' ? 'teal' : 'purple'} size="sm">
							{agentType === 'external_api' ? 'External API' : 'CrewAI'}
						</Tag>
						<span className={styles.createdAt}>
							Created {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'Unknown'}
						</span>
					</div>
				</div>

				<div className={styles.contentRow}>
					{/* Stats Section */}
					<div className={styles.statsSection}>
						<div className={styles.statsGrid}>
							<Tile className={styles.statTile}>
								<div className={styles.statValue}>{stats.totalRuns}</div>
								<div className={styles.statLabel}>Total runs</div>
							</Tile>
							<Tile className={styles.statTile}>
								<div className={styles.statValue}>{stats.successRate.toFixed(1)}%</div>
								<div className={styles.statLabel}>Success rate</div>
							</Tile>
							<Tile className={styles.statTile}>
								<div className={styles.statValue}>
									{stats.avgExecutionTime > 0 ? (stats.avgExecutionTime / 1000).toFixed(2) : '0.00'}s
								</div>
								<div className={styles.statLabel}>Avg execution time</div>
							</Tile>
							<Tile className={styles.statTile}>
								<div className={styles.statValue}>
									{stats.lastRun ? new Date(stats.lastRun).toLocaleDateString() : 'Never'}
								</div>
								<div className={styles.statLabel}>Last run</div>
							</Tile>
						</div>
					</div>

					{/* Configuration Section */}
					<div className={styles.configSection}>
						<div className={styles.section}>
					<h2 className={styles.sectionTitle}>Configuration</h2>

					<Accordion>
						<AccordionItem title="Prompt">
							<div className={styles.configContent}>
								<CodeSnippet type="multi" feedback="Copied to clipboard">
									{agent.prompt || '(empty)'}
								</CodeSnippet>
							</div>
						</AccordionItem>

						{agentType === 'crew_ai' && (
							<>
								{settings.role && (
									<AccordionItem title="Role">
										<div className={styles.configContent}>
											<p>{settings.role}</p>
										</div>
									</AccordionItem>
								)}
								{settings.goal && (
									<AccordionItem title="Goal">
										<div className={styles.configContent}>
											<p>{settings.goal}</p>
										</div>
									</AccordionItem>
								)}
								{settings.backstory && (
									<AccordionItem title="Backstory">
										<div className={styles.configContent}>
											<p>{settings.backstory}</p>
										</div>
									</AccordionItem>
								)}
								{(settings.model || settings.base_url || settings.temperature !== undefined) && (
									<AccordionItem title="Model settings">
										<div className={styles.configContent}>
											{settings.model && <p><strong>Model:</strong> {settings.model}</p>}
											{settings.base_url && <p><strong>Base URL:</strong> {settings.base_url}</p>}
											{settings.temperature !== undefined && <p><strong>Temperature:</strong> {settings.temperature}</p>}
											{settings.max_tokens !== undefined && <p><strong>Max tokens:</strong> {settings.max_tokens}</p>}
										</div>
									</AccordionItem>
								)}
							</>
						)}

						{agentType === 'external_api' && (
							<>
								{settings.api_endpoint && (
									<AccordionItem title="API endpoint">
										<div className={styles.configContent}>
											<p><strong>URL:</strong> {settings.api_endpoint}</p>
											{settings.http_method && <p><strong>Method:</strong> {settings.http_method}</p>}
										</div>
									</AccordionItem>
								)}
								{settings.request_template && (
									<AccordionItem title="Request template">
										<div className={styles.configContent}>
											<CodeSnippet type="multi" feedback="Copied to clipboard">
												{typeof settings.request_template === 'string'
													? settings.request_template
													: JSON.stringify(settings.request_template, null, 2)}
											</CodeSnippet>
										</div>
									</AccordionItem>
								)}
								{settings.response_mapping && (
									<AccordionItem title="Response mapping">
										<div className={styles.configContent}>
											<CodeSnippet type="multi" feedback="Copied to clipboard">
												{typeof settings.response_mapping === 'string'
													? settings.response_mapping
													: JSON.stringify(settings.response_mapping, null, 2)}
											</CodeSnippet>
										</div>
									</AccordionItem>
								)}
								{settings.token_mapping && (
									<AccordionItem title="Token mapping">
										<div className={styles.configContent}>
											<CodeSnippet type="multi" feedback="Copied to clipboard">
												{typeof settings.token_mapping === 'string'
													? settings.token_mapping
													: JSON.stringify(settings.token_mapping, null, 2)}
											</CodeSnippet>
										</div>
									</AccordionItem>
								)}
								{settings.headers && (
									<AccordionItem title="Headers">
										<div className={styles.configContent}>
											<CodeSnippet type="multi" feedback="Copied to clipboard">
												{typeof settings.headers === 'string'
													? settings.headers
													: JSON.stringify(settings.headers, null, 2)}
											</CodeSnippet>
										</div>
									</AccordionItem>
								)}
							</>
						)}

						{Object.keys(settings).length > 0 && (
							<AccordionItem title="Raw settings">
								<div className={styles.configContent}>
									<CodeSnippet type="multi" feedback="Copied to clipboard">
										{JSON.stringify(settings, null, 2)}
									</CodeSnippet>
								</div>
							</AccordionItem>
						)}
					</Accordion>
						</div>
					</div>
				</div>

				{/* Recent sessions */}
				{recentSessions.length > 0 && (
					<div className={styles.section}>
						<h2 className={styles.sectionTitle}>Recent sessions</h2>
						<SessionsTable
							sessions={recentSessions}
							agents={agent ? [agent] : []}
							conversations={Array.from(conversations.values())}
							sessionMessages={sessionMessages}
							limit={10}
							hiddenColumns={['agent']}
						/>
					</div>
				)}
			</div>

			{/* Modals */}
			<AgentFormModal
				isOpen={editModalOpen}
				editingId={agent.id || null}
				formData={initialFormData}
				onClose={() => setEditModalOpen(false)}
				onSuccess={() => {
					load();
					setEditModalOpen(false);
				}}
			/>

			<DeleteConfirmationModal
				isOpen={deleteModalOpen}
				deleteType="agent"
				deleteName={agent.name}
				deleteId={agent.id || null}
				onClose={() => setDeleteModalOpen(false)}
				onSuccess={() => {
					router.push('/agents');
				}}
			/>
		</div>
	);
}
