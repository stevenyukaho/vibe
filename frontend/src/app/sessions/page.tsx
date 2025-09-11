'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InlineLoading, Pagination } from '@carbon/react';
import { Report } from '@carbon/icons-react';
import styles from '../page.module.scss';
import EmptyState from '../components/EmptyState';
import TableRenderer from '../components/TableRenderer';
import { api, ExecutionSession, Agent, Conversation, TestResult } from '../../lib/api';

interface SessionWithDetails extends ExecutionSession {
	agent_name?: string;
	conversation_name?: string;
	input_tokens?: number;
	output_tokens?: number;
	similarity_score?: number;
	similarity_scoring_status?: string;
	similarity_scoring_error?: string;
}

export default function SessionsPage() {
	const router = useRouter();
	const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(0);
	const [pageSize, setPageSize] = useState(50);
	const [totalCount, setTotalCount] = useState(0);

	const loadData = async () => {
		try {
			setLoading(true);
			const [sessionsResponse, agentsResponse, conversationsResponse] = await Promise.all([
				api.getExecutionSessions({ limit: pageSize, offset: currentPage * pageSize }),
				api.getAgents(),
				api.getConversations({ limit: 1000, offset: 0 })
			]);

			setSessions(sessionsResponse.data);
			setTotalCount(sessionsResponse.total);
			setAgents(agentsResponse);
			setConversations(conversationsResponse.data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load sessions');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPage, pageSize]);

	const sessionRows = useMemo(() => {
		const agentMap = new Map(agents.map(agent => [agent.id, agent]));
		const conversationMap = new Map(conversations.map(conv => [conv.id, conv]));

		return sessions.map((session) => {
			const agent = agentMap.get(session.agent_id);
			const conversation = conversationMap.get(session.conversation_id);

			// Extract token usage from metadata
			let inputTokens = 0;
			let outputTokens = 0;
			if (session.metadata) {
				try {
					const metadata = JSON.parse(session.metadata);
					inputTokens = metadata.input_tokens || 0;
					outputTokens = metadata.output_tokens || 0;
				} catch {
					// Ignore parsing errors
				}
			}

			const totalTokens = inputTokens + outputTokens;
			let tokenDisplay = '';
			if (totalTokens > 0) {
				if (inputTokens > 0 && outputTokens > 0) {
					tokenDisplay = `${inputTokens.toLocaleString()} + ${outputTokens.toLocaleString()} = ${totalTokens.toLocaleString()}`;
				} else if (inputTokens > 0) {
					tokenDisplay = `${inputTokens.toLocaleString()} input`;
				} else if (outputTokens > 0) {
					tokenDisplay = `${outputTokens.toLocaleString()} output`;
				} else {
					tokenDisplay = totalTokens.toLocaleString();
				}
			} else {
				tokenDisplay = '-';
			}

			// Create a mock result object for similarity score display
			const mockResult = {
				...session,
				input_tokens: inputTokens,
				output_tokens: outputTokens,
				similarity_score: session.metadata
					? (() => {
						try {
							const metadata = JSON.parse(session.metadata);
							return metadata.similarity_score;
						} catch {
							return undefined;
						}
					})()
					: undefined,
				similarity_scoring_status: session.metadata
					? (() => {
						try {
							const metadata = JSON.parse(session.metadata);
							return metadata.similarity_scoring_status;
						} catch {
							return undefined;
						}
					})()
					: undefined,
				similarity_scoring_error: session.metadata
					? (() => {
						try {
							const metadata = JSON.parse(session.metadata);
							return metadata.similarity_scoring_error;
						} catch {
							return undefined;
						}
					})()
					: undefined
			};

			return {
				id: session.id?.toString() || `session-${Date.now()}`,
				agent_name: agent?.name || 'Unknown',
				conversation_name: conversation?.name || 'Unknown',
				success: session.success ?? false,
				execution_time: session.started_at && session.completed_at
					? ((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000).toFixed(3)
					: '0.000',
				token_usage: tokenDisplay,
				similarity_score: mockResult as unknown as TestResult,
				created_at: session.started_at ? new Date(session.started_at).toLocaleString() : '-'
			};
		});
	}, [sessions, agents, conversations]);

	const sessionHeaders = [
		{ key: 'agent_name', header: 'Agent' },
		{ key: 'conversation_name', header: 'Conversation' },
		{ key: 'success', header: 'Success' },
		{ key: 'execution_time', header: 'Time (s)' },
		{ key: 'token_usage', header: 'Tokens' },
		{ key: 'similarity_score', header: 'Similarity score' },
		{ key: 'created_at', header: 'Started at' },
		{ key: 'actions', header: 'Actions' }
	];

	const handleViewSession = (id: number) => {
		const session = sessions.find(s => s.id === id);
		if (session) {
			router.push(`/conversations/${session.conversation_id}`);
		}
	};

	return (
		<>
			<div className={styles.panelHeader}>
				<h2>Sessions</h2>
			</div>
			{sessionRows.length > 0 ? (
				<>
					<TableRenderer
						headers={sessionHeaders}
						rows={sessionRows}
						type="result"
						onView={handleViewSession}
					/>

					{/* Pagination */}
					{totalCount > 0 && (
						<Pagination
							totalItems={totalCount}
							pageSize={pageSize}
							pageSizes={[10, 25, 50, 100]}
							page={currentPage + 1} // Carbon uses 1-based indexing
							onChange={({ page, pageSize: newPageSize }) => {
								if (newPageSize !== pageSize) {
									setPageSize(newPageSize);
									setCurrentPage(0);
								} else {
									setCurrentPage(page - 1); // Convert back to 0-based indexing
								}
							}}
							backwardText="Previous page"
							forwardText="Next page"
							itemsPerPageText="Items per page:"
						/>
					)}
				</>
			) : loading ? (
				<InlineLoading description="Loading data..." />
			) : error ? (
				<div style={{ color: 'red', padding: '1rem' }}>{error}</div>
			) : (
				<EmptyState
					title="Sessions"
					description="Execute conversations to see session transcripts here."
					icon={Report}
					onAddClick={() => router.push('/conversations')}
				/>
			)}
		</>
	);
}


