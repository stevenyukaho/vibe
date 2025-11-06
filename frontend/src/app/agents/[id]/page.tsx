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
import { calculateExecutionTime, getSimilarityScore, sortSessionsByTime } from '../../components/AgentAnalytics/analyticsUtils';
import AgentFormModal from '../../components/AgentFormModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import SessionsTable from '../../components/SessionsTable';
import AgentAnalytics from '../../components/AgentAnalytics';
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
	const [allSessions, setAllSessions] = useState<ExecutionSession[]>([]);
	const [conversations, setConversations] = useState<Map<number, { name: string; id: number }>>(new Map());
	const [sessionMessages, setSessionMessages] = useState<Map<number, SessionMessage[]>>(new Map());
	const [stats, setStats] = useState({
		totalRuns: 0,
		successRate: 0,
		avgExecutionTime: 0,
		avgSimilarity: null as number | null,
		lastRun: null as string | null,
		trends: {
			successRate: 0,
			similarity: null as number | null,
			executionTime: null as number | null
		}
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

			// Load all sessions for stats calculation and analytics
			const allSessionsData = await api.getExecutionSessions({ agent_id: id, limit: 1000, offset: 0 });
			setAllSessions(allSessionsData.data);

			// Load messages for all sessions for similarity calculation
			const allMessagesMap = await loadSessionMessages(allSessionsData.data);
			setSessionMessages(allMessagesMap);

			// Calculate stats from all sessions
			const calculatedStats = calculateSessionStats(allSessionsData.data);

			// Calculate performance metrics and trends
			const sorted = sortSessionsByTime(allSessionsData.data);

			const midpoint = Math.floor(sorted.length / 2);
			const firstHalf = sorted.slice(0, midpoint);
			const secondHalf = sorted.slice(midpoint);

			const calculateMetrics = (sessions: typeof sorted) => {
				let successCount = 0;
				let totalSimilarity = 0;
				let similarityCount = 0;
				let totalExecutionTime = 0;
				let executionTimeCount = 0;

				sessions.forEach(session => {
					if (session.success) {
						successCount++;
					}

					const execTime = calculateExecutionTime(session);
					if (execTime > 0) {
						totalExecutionTime += execTime;
						executionTimeCount++;
					}

					const { similarity, hasSimilarity } = getSimilarityScore(session.id, allMessagesMap);
					if (hasSimilarity) {
						totalSimilarity += similarity;
						similarityCount++;
					}
				});

				return {
					successRate: sessions.length > 0 ? (successCount / sessions.length) * 100 : 0,
					avgSimilarity: similarityCount > 0 ? totalSimilarity / similarityCount : null,
					avgExecutionTime: executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : null
				};
			};

			const overall = calculateMetrics(sorted);
			const first = firstHalf.length > 0 ? calculateMetrics(firstHalf) : overall;
			const second = secondHalf.length > 0 ? calculateMetrics(secondHalf) : overall;

			setStats({
				totalRuns: allSessionsData.total,
				successRate: overall.successRate,
				avgExecutionTime: overall.avgExecutionTime ? overall.avgExecutionTime * 1000 : 0, // Convert to ms
				avgSimilarity: overall.avgSimilarity,
				lastRun: calculatedStats.lastRun,
				trends: {
					successRate: second.successRate - first.successRate,
					similarity: overall.avgSimilarity && first.avgSimilarity && second.avgSimilarity
						? second.avgSimilarity - first.avgSimilarity
						: null,
					executionTime: overall.avgExecutionTime && first.avgExecutionTime && second.avgExecutionTime
						? second.avgExecutionTime - first.avgExecutionTime
						: null
				}
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
								<div className={styles.statHeader}>
									<span className={styles.statLabel}>Success rate</span>
									{stats.trends.successRate !== 0 && (
										<span className={stats.trends.successRate > 0 ? styles.trendUp : styles.trendDown}>
											{stats.trends.successRate > 0 ? '↑' : '↓'}
											{Math.abs(stats.trends.successRate).toFixed(1)}%
										</span>
									)}
								</div>
								<div className={styles.statValue}>{stats.successRate.toFixed(1)}%</div>
								<div className={styles.statInfo}>Comparing first vs second half of sessions</div>
							</Tile>

							{stats.avgSimilarity !== null && (
								<Tile className={styles.statTile}>
									<div className={styles.statHeader}>
										<span className={styles.statLabel}>Avg similarity</span>
										{stats.trends.similarity !== null && stats.trends.similarity !== 0 && (
											<span className={stats.trends.similarity > 0 ? styles.trendUp : styles.trendDown}>
												{stats.trends.similarity > 0 ? '↑' : '↓'}
												{Math.abs(stats.trends.similarity).toFixed(1)}
											</span>
										)}
									</div>
									<div className={styles.statValue}>{stats.avgSimilarity.toFixed(1)}</div>
									<div className={styles.statInfo}>Maximum score per session</div>
								</Tile>
							)}

							<Tile className={styles.statTile}>
								<div className={styles.statHeader}>
									<span className={styles.statLabel}>Avg exec time</span>
									{stats.trends.executionTime !== null && stats.trends.executionTime !== 0 && (
										<span className={stats.trends.executionTime < 0 ? styles.trendUp : styles.trendDown}>
											{stats.trends.executionTime < 0 ? '↓' : '↑'}
											{Math.abs(stats.trends.executionTime).toFixed(1)}s
										</span>
									)}
								</div>
								<div className={styles.statValue}>
									{stats.avgExecutionTime > 0 ? (stats.avgExecutionTime / 1000).toFixed(2) : '0.00'}s
								</div>
								<div className={styles.statInfo}>Time from start to completion</div>
							</Tile>

							<Tile className={styles.statTile}>
								<div className={styles.statHeader}>
									<span className={styles.statLabel}>Total sessions</span>
								</div>
								<div className={styles.statValue}>{stats.totalRuns}</div>
								<div className={styles.statInfo}>
									Last run: {stats.lastRun ? new Date(stats.lastRun).toLocaleDateString() : 'Never'}
								</div>
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

				{/* Analytics */}
				{allSessions.length > 0 && (
					<div className={styles.section}>
						<h2 className={styles.sectionTitle}>Analytics</h2>
						<AgentAnalytics sessions={allSessions} />
					</div>
				)}

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
