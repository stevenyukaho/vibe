'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, SuiteRun, Job, TestResult } from '../../../lib/api';
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
	Grid,
	Column,
	Tag,
	Button,
	ProgressBar,
	Tile
} from '@carbon/react';
import { ChevronLeft, ViewFilled } from '@carbon/icons-react';
import ResultViewModal from '../../components/ResultViewModal';
import styles from './page.module.scss';
import SimilarityScoreDisplay from '../../components/SimilarityScoreDisplay';

export default function SuiteRunDetailPage() {
	const params = useParams();
	const router = useRouter();
	const rawId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
	const runId = parseInt(rawId, 10);

	const [suiteRun, setSuiteRun] = useState<SuiteRun | null>(null);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [previousStatus, setPreviousStatus] = useState<string | null>(null);
	const [freshResults, setFreshResults] = useState<Map<number, TestResult>>(new Map());

	// Result modal state
	const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [resultError, setResultError] = useState<string | null>(null);

	const { getTestById, getResultById: getResultByIdFromCache, getAgentById, fetchAllData, fetchResults } = useAppData();
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
				if (!job.result_id) {
					return false;
				}
				const result = freshResults.get(job.result_id);
				if (!result) {
					return true;
				}

				const scoringStatus = result.similarity_scoring_status;
				// Only poll if scoring is actively in progress, not if it was never started (null)
				return scoringStatus === 'pending' || scoringStatus === 'running';
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
			const newlyCompletedJobs = jobsData.filter(job =>
				job.result_id && !freshResults.has(job.result_id),
			);
			return newlyCompletedJobs.length > 0;
		}

		if (suiteRunData.status === 'completed') {
			const jobsWithActiveSimilarityScoring = jobsData.filter(job => {
				if (!job.result_id) {
					return false;
				}
				const result = freshResults.get(job.result_id);
				if (!result) {
					return true;
				}

				const scoringStatus = result.similarity_scoring_status;
				// Only fetch if scoring is actively in progress, not if it was never started (null)
				return scoringStatus === 'pending' || scoringStatus === 'running';
			});

			return jobsWithActiveSimilarityScoring.length > 0;
		}

		return false;
	}, [freshResults]);

	const fetchFreshResultsConditionally = useCallback(async (suiteRunData: SuiteRun, jobsData: Job[]) => {
		const jobsToFetch = jobsData.filter(job => {
			if (!job.result_id) {
				return false;
			}

			const existingResult = freshResults.get(job.result_id);
			if (!existingResult) {
				return true;
			}

			if (suiteRunData.status === 'running') {
				return !freshResults.has(job.result_id);
			}

			const scoringStatus = existingResult.similarity_scoring_status;
			return scoringStatus === 'pending' || scoringStatus === 'running';
		});

		if (jobsToFetch.length === 0) {
			return;
		}

		const resultPromises = jobsToFetch.map(async (job) => {
			try {
				const result = await getResultById(job.result_id!);
				return [job.result_id!, result] as [number, TestResult];
			} catch (err) {
				console.error(`Failed to fetch result ${job.result_id}:`, err);
				return null;
			}
		});

		const results = await Promise.all(resultPromises);
		const newResults = results.filter(Boolean) as [number, TestResult][];

		setFreshResults(prev => new Map([...prev, ...newResults]));
	}, [freshResults, getResultById]);

	const handleResultView = async (id: number) => {
		try {
			setResultError(null);
			const result = await getResultById(id);
			setSelectedResult(result);
			setModalOpen(true);
		} catch (err) {
			setResultError(err instanceof Error ? err.message : 'Failed to fetch result');
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

				await fetchResults();

				if (shouldFetchFreshResults(runData, jobsData)) {
					await fetchFreshResultsConditionally(runData, jobsData);
				}

				if (!mounted) return;

				// Check if status changed to "completed" and refresh all data
				if (previousStatus !== runData.status && runData.status === 'completed') {
					await fetchAllData();
				}

				// Check if any job got a new result_id (indicating it just completed)
				const newlyCompletedJobs = jobsData.filter(job =>
					job.result_id && !jobs.find(prevJob =>
						prevJob.id === job.id && prevJob.result_id === job.result_id,
					),
				);

				if (newlyCompletedJobs.length > 0) {
					await fetchAllData();
				}

				setPreviousStatus(runData.status);
				setSuiteRun(runData);
				setJobs(jobsData);

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
	}, [runId, previousStatus, fetchAllData, fetchResults, shouldPollData, shouldFetchFreshResults, fetchFreshResultsConditionally]);

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
		{ key: 'test', header: 'Test' },
		{ key: 'agent', header: 'Agent' },
		{ key: 'status', header: 'Status' },
		{ key: 'progress', header: 'Progress' },
		{ key: 'token_usage', header: 'Tokens' },
		{ key: 'similarity_score', header: 'Similarity score' },
		{ key: 'actions', header: 'Actions' }
	];

	const rows = jobs.map((job) => {
		const testName = job.test_id ? getTestById(job.test_id)?.name || `Test #${job.test_id}` : `Conversation #${job.conversation_id}`;
		const agent = getAgentById(job.agent_id);
		const agentName = agent ? `${agent.name} (v${agent.version})` : `Agent #${job.agent_id}`;
		// Use fresh results if available, otherwise fall back to cache
		const result = job.result_id ? (freshResults.get(job.result_id) || getResultByIdFromCache(job.result_id)) : null;

		// Calculate token usage display
		let tokenDisplay = '-';
		if (result && (result.input_tokens || result.output_tokens)) {
			const inputTokens = result.input_tokens || 0;
			const outputTokens = result.output_tokens || 0;
			const totalTokens = inputTokens + outputTokens;

			if (totalTokens > 0) {
				if (inputTokens > 0 && outputTokens > 0) {
					tokenDisplay = `${inputTokens} + ${outputTokens} = ${totalTokens}`;
				} else {
					tokenDisplay = totalTokens.toString();
				}
			}
		}

		return {
			id: String(job.id),
			test: testName,
			agent: agentName,
			status: { value: job.status, error: job.error },
			progress: job.progress,
			token_usage: tokenDisplay,
			similarity_score: result,
			actions: job.result_id ? (
				<Button
					kind="ghost"
					size="sm"
					renderIcon={ViewFilled}
					onClick={() => handleResultView(job.result_id!)}
				>
					View Result
				</Button>
			) : null
		};
	});

	// Determine tag color for suite run status
	const getStatusTagType = (status: string) => {
		switch (status.toLowerCase()) {
			case 'completed': return 'green';
			case 'running': return 'blue';
			case 'failed': return 'red';
			case 'queued': return 'purple';
			default: return 'gray';
		}
	};

	return (
		<Grid>
			<Column sm={4} md={8} lg={16}>
				<div className={styles.backButtonRow}>
					<Button
						kind="ghost"
						onClick={() => router.push('/suite-runs')}
						renderIcon={ChevronLeft}
					>
						Back to suite runs
					</Button>
				</div>

				<h1>Suite run {suiteRun.id}</h1>

				<Tile className={styles.statusPanel}>
					<div className={styles.statusCardContent}>
						<div>
							<p className={styles.label}>Status:</p>
							<Tag type={getStatusTagType(suiteRun.status)}>{suiteRun.status}</Tag>
						</div>
						{(suiteRun.status === 'running') && (
							<div>
								<p className={styles.label}>Progress:</p>
								<div className={styles.fullWidth}>
									<ProgressBar
										value={suiteRun.progress}
										max={100}
										label="Progress"
										helperText={`${suiteRun.completed_tests}/${suiteRun.total_tests} tests completed`}
									/>
								</div>
							</div>
						)}
						{/* Token usage summary */}
						{((suiteRun.total_input_tokens || 0) + (suiteRun.total_output_tokens || 0)) > 0 && (
							<div>
								<p className={styles.label}>Token Usage:</p>
								<div className={styles.tokenRow}>
									<span>Input: {(suiteRun.total_input_tokens || 0).toLocaleString()}</span>
									<span>Output: {(suiteRun.total_output_tokens || 0).toLocaleString()}</span>
									<strong>Total: {((suiteRun.total_input_tokens || 0) + (suiteRun.total_output_tokens || 0)).toLocaleString()}</strong>
								</div>
							</div>
						)}
					</div>
				</Tile>
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
				)}

				<ResultViewModal
					isOpen={modalOpen}
					result={selectedResult}
					error={resultError}
					onClose={() => setModalOpen(false)}
				/>
			</Column>
		</Grid>
	);
}
