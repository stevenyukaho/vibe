'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, SuiteRun, Job, TestResult, Conversation } from '../../../lib/api';
import { useAppData } from '@/lib/AppDataContext';
import { useResultOperations } from '@/lib/AppDataContext';
import {
	DataTable,
	Table,
	TableHead,
	TableRow,
	TableHeader,
	TableBody,
	TableCell,
	InlineLoading,
	InlineNotification,
	Tag,
	Button,
	ProgressBar,
	Tile,
	OverflowMenu,
	OverflowMenuItem
} from '@carbon/react';
import Link from 'next/link';
import {
	ViewFilled,
	ChartLine,
	CheckmarkFilled,
	Warning,
	ArrowLeft
} from '@carbon/icons-react';
import styles from './page.module.scss';
import SimilarityScoreDisplay from '../../components/SimilarityScoreDisplay';
import TokenUsageTile from '../../components/TokenUsageTile';
import { getJobId, isScoringActive, getStatusTagType, formatTokenUsage } from '../../../lib/utils';

export default function SuiteRunDetailPage() {
	const params = useParams();
	const router = useRouter();
	const rawId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
	const runId = parseInt(rawId, 10);

	const [suiteRun, setSuiteRun] = useState<SuiteRun | null>(null);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [conversations, setConversations] = useState<Map<number, Conversation>>(new Map());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [previousStatus, setPreviousStatus] = useState<string | null>(null);
	const [freshResults, setFreshResults] = useState<Map<number, TestResult>>(new Map());
	// Per-id skip counter to avoid hammering failing result ids across polling cycles
	const [skipCounts, setSkipCounts] = useState<Map<number, number>>(new Map());

	const [metrics, setMetrics] = useState({
		totalJobs: 0,
		completedJobs: 0,
		failedJobs: 0,
		successRate: 0,
		avgSimilarityScore: 0,
		totalTokens: 0,
		totalDuration: 0
	});

	const { getTestById, getResultById: getResultByIdFromCache, getAgentById, fetchAllData } = useAppData();
	const { getResultById } = useResultOperations();

	const shouldPollData = useCallback((suiteRunData?: SuiteRun, jobsData?: Job[]) => {
		if (!suiteRunData || !jobsData) {
			return true;
		}

		if (suiteRunData.status === 'running') {
			return true;
		}

		if (suiteRunData.status === 'completed') {
			const activeScoringJobs = jobsData.filter(job => {
				const jobId = getJobId(job);
				if (!jobId) {
					return false;
				}
				const result = freshResults.get(jobId);
				if (!result) {
					return true;
				}

				const scoringStatus = result.similarity_scoring_status;
				// Only poll if scoring is actively in progress, not if it was never started (null)
				return isScoringActive(scoringStatus);
			});

			return activeScoringJobs.length > 0;
		}

		return false;
	}, [freshResults]);

	// Smart conditional fetching for individual results
	const shouldFetchFreshResults = useCallback((suiteRunData: SuiteRun, jobsData: Job[]) => {
		if (freshResults.size === 0) {
			return true;
		}

		if (suiteRunData.status === 'running') {
			const newlyCompletedJobs = jobsData.filter(job => {
				const id = getJobId(job);
				return !!id && !freshResults.has(id);
			});
			return newlyCompletedJobs.length > 0;
		}

		if (suiteRunData.status === 'completed') {
			const jobsWithActiveSimilarityScoring = jobsData.filter(job => {
				const id = getJobId(job);
				if (!id) return false;
				const result = freshResults.get(id);
				if (!result) return true;
				const scoringStatus = result.similarity_scoring_status;
				// Only fetch if scoring is actively in progress, not if it was never started (null)
				return isScoringActive(scoringStatus);
			});

			return jobsWithActiveSimilarityScoring.length > 0;
		}

		return false;
	}, [freshResults]);

	const fetchFreshResultsConditionally = useCallback(async (suiteRunData: SuiteRun, jobsData: Job[]) => {
		// Determine which jobs to fetch this cycle and decrement skip counts for skipped ids
		const toDecrement: number[] = [];
		const jobsToFetch = jobsData.filter(job => {
			const id = getJobId(job);
			if (!id) {
				return false;
			}
			const count = skipCounts.get(id) || 0;
			if (count > 0) {
				toDecrement.push(id);
				return false;
			}

			const existingResult = freshResults.get(id);
			if (!existingResult) {
				return true;
			}

			if (suiteRunData.status === 'running') {
				return !freshResults.has(id);
			}

			const scoringStatus = existingResult.similarity_scoring_status;
			return isScoringActive(scoringStatus);
		});

		if (toDecrement.length > 0) {
			setSkipCounts(prev => {
				const next = new Map(prev);
				for (const id of toDecrement) {
					const c = next.get(id) || 0;
					if (c > 0) next.set(id, c - 1);
				}
				return next;
			});
		}

		if (jobsToFetch.length === 0) {
			return;
		}

		const resultPromises = jobsToFetch.map(async (job) => {
			const id = getJobId(job)!;
			try {
				let result: TestResult;
				if (job.session_id) {
					// For session-based jobs, fetch session data and convert to legacy result format
					const sessionData = await api.getExecutionSessionById(id);
					const sessionMessages = await api.getSessionTranscript(id);
					// Convert session to legacy result format for compatibility
					result = {
						id: sessionData.id!,
						test_id: sessionData.conversation_id,
						agent_id: sessionData.agent_id,
						output: '', // Will be populated from messages
						success: sessionData.success || false,
						similarity_score: 0, // Will be calculated from messages
						similarity_scoring_status: 'completed',
						input_tokens: 0, // Will be calculated from messages
						output_tokens: 0, // Will be calculated from messages
						created_at: sessionData.started_at || new Date().toISOString()
					};

					// Calculate tokens and similarity from messages
					const assistantMessages = sessionMessages.filter(m => m.role === 'assistant');
					if (assistantMessages.length > 0) {
						const scoredMessage = assistantMessages.find(m =>
							m.similarity_scoring_status === 'completed' &&
							typeof m.similarity_score === 'number'
						);
						if (scoredMessage) {
							result.similarity_score = scoredMessage.similarity_score!;
						}

						// Calculate tokens from all messages
						const totalInputTokens = sessionMessages.reduce((sum, m) => {
							const metadata = m.metadata ? JSON.parse(m.metadata) : {};
							return sum + (metadata.input_tokens || 0);
						}, 0);
						const totalOutputTokens = sessionMessages.reduce((sum, m) => {
							const metadata = m.metadata ? JSON.parse(m.metadata) : {};
							return sum + (metadata.output_tokens || 0);
						}, 0);

						result.input_tokens = totalInputTokens;
						result.output_tokens = totalOutputTokens;
					}
				} else {
					// For legacy result-based jobs
					result = await getResultById(id);
				}
				return [id, result] as [number, TestResult];
			} catch {
				// On failure, skip next N polling cycles for this id (e.g., ~10s at 2s interval)
				const SKIP_POLLS = 5;
				setSkipCounts(prev => new Map(prev).set(id, SKIP_POLLS));
				return null;
			}
		});

		const results = await Promise.all(resultPromises);
		const newResults = results.filter(Boolean) as [number, TestResult][];

		if (newResults.length > 0) {
			setFreshResults(prev => new Map([...prev, ...newResults]));
			// Clear skip counters for successfully fetched ids
			setSkipCounts(prev => {
				const next = new Map(prev);
				for (const [id] of newResults) {
					next.delete(id);
				}
				return next;
			});
		}
	}, [freshResults, getResultById, skipCounts]);

	const handleViewSession = (sessionId: number) => {
		router.push(`/sessions/${sessionId}`);
	};

	const handleViewConversation = (conversationId: number) => {
		router.push(`/conversations/${conversationId}`);
	};

	// Fetch conversations referenced by jobs
	const fetchConversationsForJobs = async (jobsData: Job[]) => {
		const conversationIds = jobsData
			.filter(job => job.conversation_id)
			.map(job => job.conversation_id!)
			.filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

		if (conversationIds.length === 0) return;

		try {
			const conversationPromises = conversationIds.map(async (id) => {
				try {
					const conversation = await api.getConversationById(id);
					return [id, conversation] as [number, Conversation];
				} catch {
					return null;
				}
			});

			const conversationResults = await Promise.all(conversationPromises);
			const validConversations = conversationResults.filter(Boolean) as [number, Conversation][];

			setConversations(new Map(validConversations));
		} catch {
			setConversations(new Map());
		}
	};

	useEffect(() => {
		if (isNaN(runId)) {
			setError('Invalid suite run ID');
			setLoading(false);
			return;
		}

		let mounted = true;
		let interval: NodeJS.Timeout | null = null;

		async function fetchData() {
			try {
				const [runData, jobsData] = await Promise.all([
					api.getSuiteRun(runId),
					api.getSuiteRunJobs(runId)
				]);

				// Fetch conversations for jobs
				await fetchConversationsForJobs(jobsData);

				if (shouldFetchFreshResults(runData, jobsData)) {
					await fetchFreshResultsConditionally(runData, jobsData);
				}

				if (!mounted) return;

				// Check if status changed to "completed" and refresh all data
				if (previousStatus !== runData.status && runData.status === 'completed') {
					await fetchAllData();
				}

				// Check if any job got a new result_id (indicating it just completed)
				const newlyCompletedJobs = jobsData.filter(job => {
					const id = getJobId(job);
					const prev = jobs.find(prevJob => prevJob.id === job.id);
					const prevId = prev ? getJobId(prev) : null;
					return !!id && id !== prevId;
				});

				if (newlyCompletedJobs.length > 0) {
					await fetchAllData();
				}

				setPreviousStatus(runData.status);
				setSuiteRun(runData);
				setJobs(jobsData);

				// Calculate metrics
				const completedJobs = jobsData.filter(job => job.status === 'completed').length;
				const failedJobs = jobsData.filter(job => job.status === 'failed').length;
				const totalJobs = jobsData.length;
				const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

				// Calculate average similarity score from fresh results
				const scoredResults = Array.from(freshResults.values()).filter(result =>
					result.similarity_scoring_status === 'completed' &&
					typeof result.similarity_score === 'number'
				);
				const avgSimilarityScore = scoredResults.length > 0
					? scoredResults.reduce((sum, result) => sum + (result.similarity_score || 0), 0) / scoredResults.length
					: 0;

				// Calculate total tokens
				const totalTokens = Array.from(freshResults.values()).reduce((sum, result) => {
					return sum + (result.input_tokens || 0) + (result.output_tokens || 0);
				}, 0);

				// Calculate total duration (estimate from suite run data)
				const totalDuration = runData.average_execution_time || 0;

				setMetrics({
					totalJobs,
					completedJobs,
					failedJobs,
					successRate,
					avgSimilarityScore,
					totalTokens,
					totalDuration
				});

				// Setup next interval based on whether we still need polling
				if (mounted && shouldPollData(runData, jobsData)) {
					interval = setTimeout(fetchData, 2000);
				}
			} catch (err: unknown) {
				if (err instanceof Error) setError(err.message);
				else setError(String(err));

				// On error, continue polling to retry
				if (mounted) {
					interval = setTimeout(fetchData, 2000);
				}
			} finally {
				if (mounted) setLoading(false);
			}
		}

		// Initial fetch
		fetchData();

		return () => {
			mounted = false;
			if (interval) clearTimeout(interval);
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [runId, previousStatus, fetchAllData, shouldPollData, shouldFetchFreshResults, fetchFreshResultsConditionally]);

	if (loading) {
		return <InlineLoading description="Loading suite run details..." />;
	}
	if (error) {
		return <InlineNotification kind="error" title="Error" subtitle={error} hideCloseButton />;
	}
	if (!suiteRun) {
		return <InlineNotification kind="error" title="Error" subtitle="Suite run not found." hideCloseButton />;
	}

	const headers = [
		{ key: 'test', header: 'Conversation' },
		{ key: 'agent', header: 'Agent' },
		{ key: 'status', header: 'Status' },
		{ key: 'progress', header: 'Progress' },
		{ key: 'token_usage', header: 'Tokens' },
		{ key: 'similarity_score', header: 'Similarity score' },
		{ key: 'actions', header: 'Actions' }
	];

    const rows = jobs.map((job) => {
        let testName = job.test_id ? getTestById(job.test_id)?.name : undefined;
        if (!testName) {
            if (job.conversation_id) {
                const conversation = conversations.get(job.conversation_id);
                testName = conversation
                    ? `${conversation.name} (#${conversation.id})`
                    : `Conversation #${job.conversation_id}`;
            } else {
                testName = `Test #${job.test_id}`;
            }
        }
		const agent = getAgentById(job.agent_id);
		const agentName = agent ? `${agent.name} (v${agent.version})` : `Agent #${job.agent_id}`;
		// Use fresh results if available, otherwise fall back to cache
		// Check both session_id and result_id for backwards compatibility
		const resultId = getJobId(job);
		const result = resultId ? (freshResults.get(resultId) || getResultByIdFromCache(resultId)) : null;

		// Calculate token usage display
		const tokenDisplay = formatTokenUsage(result || null);

		return {
			id: String(job.id),
			test: testName,
			agent: { name: agentName, id: job.agent_id },
			status: { value: job.status, error: job.error },
			progress: job.progress,
			token_usage: tokenDisplay,
			similarity_score: result,
			actions: job.session_id ? (
				<Button
					kind="ghost"
					size="sm"
					renderIcon={ViewFilled}
					iconDescription="View session details"
					hasIconOnly
					onClick={() => handleViewSession(job.session_id!)}
				/>
			) : job.conversation_id ? (
				<Button
					kind="ghost"
					size="sm"
					renderIcon={ViewFilled}
					iconDescription="View conversation details"
					hasIconOnly
					onClick={() => handleViewConversation(job.conversation_id!)}
				/>
			) : job.result_id ? (
				<Button
					kind="ghost"
					size="sm"
					renderIcon={ViewFilled}
					iconDescription="View session details"
					hasIconOnly
					onClick={() => handleViewSession(job.result_id!)}
				/>
			) : null
		};
	});


	return (
		<div className={styles.container}>
			{/* Enhanced Header */}
			<div className={styles.headerRow}>
				<div className={styles.headerLeft}>
					<h2 className={styles.title}>Suite run #{suiteRun.id}</h2>
					<div className={styles.suiteInfo}>
						<Tag type={getStatusTagType(suiteRun.status)} size="sm">
							{suiteRun.status}
						</Tag>
						<Tag type="blue" size="sm">
							{metrics.totalJobs} jobs
						</Tag>
						<Tag type={metrics.successRate >= 80 ? 'green' : metrics.successRate >= 60 ? 'cool-gray' : 'red'} size="sm">
							{metrics.successRate.toFixed(0)}% success
						</Tag>
						{metrics.avgSimilarityScore > 0 && (
							<Tag type="purple" size="sm">
								{metrics.avgSimilarityScore.toFixed(1)}% avg score
							</Tag>
						)}
					</div>
					<div className={styles.metadata}>
						<span className={styles.metaItem}>
							<strong>Started:</strong> {suiteRun.started_at ? new Date(suiteRun.started_at).toLocaleString() : 'Unknown'}
						</span>
						{suiteRun.completed_at && (
							<span className={styles.metaItem}>
								<strong>Completed:</strong> {new Date(suiteRun.completed_at).toLocaleString()}
							</span>
						)}
						{metrics.totalDuration > 0 && (
							<span className={styles.metaItem}>
								<strong>Duration:</strong> {(metrics.totalDuration / 1000).toFixed(1)}s
							</span>
						)}
					</div>
				</div>
				<div className={styles.headerRight}>
					<OverflowMenu flipped>
						<OverflowMenuItem itemText="Export results" disabled />
						<OverflowMenuItem itemText="Download logs" disabled />
						<OverflowMenuItem itemText="Compare with others" disabled />
					</OverflowMenu>
					<Button kind="tertiary" onClick={() => router.push('/suite-runs')} renderIcon={ArrowLeft}>
						Back
					</Button>
				</div>
			</div>

			{/* Statistics Cards */}
			<div className={styles.statsGrid}>
				<Tile className={styles.statCard}>
					<div className={styles.statIcon}>
						<ChartLine />
					</div>
					<div className={styles.statContent}>
						<div className={styles.statValue}>{metrics.totalJobs}</div>
						<div className={styles.statLabel}>Total jobs</div>
					</div>
				</Tile>
				<Tile className={styles.statCard}>
					<div className={styles.statIcon}>
						<CheckmarkFilled />
					</div>
					<div className={styles.statContent}>
						<div className={styles.statValue}>{metrics.completedJobs}</div>
						<div className={styles.statLabel}>Completed</div>
					</div>
				</Tile>
				<Tile className={styles.statCard}>
					<div className={styles.statIcon}>
						<Warning />
					</div>
					<div className={styles.statContent}>
						<div className={styles.statValue}>{metrics.successRate.toFixed(0)}%</div>
						<div className={styles.statLabel}>Success rate</div>
					</div>
				</Tile>
				{metrics.avgSimilarityScore > 0 && (
					<Tile className={styles.statCard}>
						<div className={styles.statIcon}>
							<ChartLine />
						</div>
						<div className={styles.statContent}>
							<div className={styles.statValue}>{metrics.avgSimilarityScore.toFixed(1)}%</div>
							<div className={styles.statLabel}>Avg similarity</div>
						</div>
					</Tile>
				)}
			</div>

			{/* Progress Section */}
			{(suiteRun.status === 'running') && (
				<div className={styles.progressSection}>
					<Tile className={styles.progressTile}>
						<div className={styles.progressHeader}>
							<h4 className={styles.progressTitle}>Execution progress</h4>
							<span className={styles.progressText}>
								{suiteRun.completed_tests}/{suiteRun.total_tests} tests completed
							</span>
						</div>
						<ProgressBar
							value={suiteRun.progress}
							max={100}
							label="Progress"
							helperText={`${suiteRun.progress.toFixed(1)}% complete`}
						/>
					</Tile>
				</div>
			)}

			{/* Token Usage Breakdown */}
			{metrics.totalTokens > 0 && (
				<TokenUsageTile
					inputTokens={suiteRun.total_input_tokens || 0}
					outputTokens={suiteRun.total_output_tokens || 0}
					totalTokens={metrics.totalTokens}
				/>
			)}

			{/* Jobs Table */}
			<div className={styles.jobsSection}>
				<div className={styles.sectionHeader}>
					<h4 className={styles.sectionTitle}>Execution jobs</h4>
				</div>

				{/* If no jobs are present after a completed run, show warning */}
				{jobs.length === 0 ? (
					<InlineNotification
						kind="warning"
						title="No test results"
						subtitle={
							suiteRun.status === 'completed'
								? 'All test jobs timed out; no results available.'
								: 'No test jobs available.'
						}
						hideCloseButton
					/>
				) : (
					<div className={styles.tableContainer}>
					<DataTable rows={rows} headers={headers}>
						{({ rows, headers, getHeaderProps, getTableProps }) => (
							<Table {...getTableProps()}>
								<TableHead>
									<TableRow>
										{headers.map((header) => {
											const headerProps = getHeaderProps({ header });
											// eslint-disable-next-line @typescript-eslint/no-unused-vars
											const { key: _key, ...otherProps } = headerProps;
											return (
												<TableHeader key={header.key} {...otherProps}>
													{header.header}
												</TableHeader>
											);
										})}
									</TableRow>
								</TableHead>
								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.id}>
											{row.cells.map((cell) => {
												// Handle status cell with Tag component and error message
												if (cell.info.header === 'status') {
													const tagType = getStatusTagType(cell.value.value);
													return (
														<TableCell key={cell.id}>
															<Tag type={tagType}>{cell.value.value}</Tag>
															{cell.value.error && cell.value.error}
														</TableCell>
													);
												}
												// Handle agent cell with link
												if (cell.info.header === 'agent') {
													return (
														<TableCell key={cell.id}>
															{cell.value && cell.value.id ? (
																<Link href={`/agents/${cell.value.id}`}>
																	{cell.value.name}
																</Link>
															) : (
																cell.value?.name || cell.value
															)}
														</TableCell>
													);
												}
												// Handle progress cell with ProgressBar component
												if (cell.info.header === 'progress') {
													return (
														<TableCell key={cell.id}>
															<div style={{ width: '100%' }}>
																<ProgressBar
																	value={cell.value}
																	max={100}
																	label=""
																	hideLabel
																/>
															</div>
															{cell.value}%
														</TableCell>
													);
												}
												// Handle similarity score cell
												if (cell.info.header === 'similarity_score') {
													return (
														<TableCell key={cell.id}>
															<SimilarityScoreDisplay result={cell.value} />
														</TableCell>
													);
												}
												// For the actions cell, render the cell value directly
												if (cell.info.header === 'actions') {
													return (
														<TableCell key={cell.id}>
															{cell.value || '--'}
														</TableCell>
													);
												}
												// Default cell rendering
												return <TableCell key={cell.id}>{cell.value}</TableCell>;
											})}
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</DataTable>
					</div>
				)}
			</div>
		</div>
	);
}
