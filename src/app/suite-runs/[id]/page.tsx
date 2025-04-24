'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, SuiteRun, Job } from '../../../lib/api';
import { useAppData } from '@/lib/AppDataContext';
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

export default function SuiteRunDetailPage() {
	const params = useParams();
	const router = useRouter();
	const rawId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
	const runId = parseInt(rawId, 10);

	const [suiteRun, setSuiteRun] = useState<SuiteRun | null>(null);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	
	// Result modal state
	const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [resultError, setResultError] = useState<string | null>(null);

	const { getTestById, getResultById } = useAppData();
	
	const handleResultView = (id: number) => {
		const result = getResultById(id);
		if (!result) {
			setResultError('Result not found');
			setModalOpen(true);
		} else {
			setResultError(null);
			setSelectedResultId(id);
			setModalOpen(true);
		}
	};

	useEffect(() => {
		if (isNaN(runId)) {
			setError('Invalid suite run ID');
			setLoading(false);
			return;
		}
		let mounted = true;
		async function fetchData() {
			try {
				const [runData, jobsData] = await Promise.all([
					api.getSuiteRun(runId),
					api.getSuiteRunJobs(runId)
				]);
				if (!mounted) return;
				setSuiteRun(runData);
				setJobs(jobsData);
			} catch (err: unknown) {
				if (err instanceof Error) setError(err.message);
				else setError(String(err));
			} finally {
				if (mounted) setLoading(false);
			}
		}
		fetchData();
		const interval = setInterval(fetchData, 2000);
		return () => { mounted = false; clearInterval(interval); };
	}, [runId]);

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
		{ key: 'status', header: 'Status' },
		{ key: 'progress', header: 'Progress' },
		{ key: 'actions', header: 'Actions' }
	];

	const rows = jobs.map((job) => {
		const testName = getTestById(job.test_id)?.name || `#${job.test_id}`;
		return {
			id: String(job.id),
			test: testName,
			status: job.status,
			progress: job.progress,
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

	const selectedResult = selectedResultId !== null ? getResultById(selectedResultId) ?? null : null;

	return (
		<Grid>
			<Column sm={4} md={8} lg={16}>
				<div style={{ marginBottom: '2rem' }}>
					<Button 
						kind="ghost" 
						onClick={() => router.push('/suite-runs')} 
						renderIcon={ChevronLeft}
					>
						Back to Suite Runs
					</Button>
				</div>

				<h1>Suite Run {suiteRun.id}</h1>
				
				<Tile style={{ marginBottom: '2rem' }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
						<div>
							<p style={{ marginBottom: '0.5rem' }}>Status:</p>
							<Tag type={getStatusTagType(suiteRun.status)}>{suiteRun.status}</Tag>
						</div>
						{(suiteRun.status === 'running') && (
							<div>
								<p style={{ marginBottom: '0.5rem' }}>Progress:</p>
								<div style={{ width: '100%', marginBottom: '0.5rem' }}>
									<ProgressBar
										value={suiteRun.progress}
										max={100}
										label="Progress"
										helperText={`${suiteRun.completed_tests}/${suiteRun.total_tests} tests completed`}
									/>
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
												// Handle status cell with Tag component
												if (cell.info.header === 'status') {
													const tagType = getStatusTagType(cell.value);
													return (
														<TableCell key={cell.id}>
															<Tag type={tagType}>{cell.value}</Tag>
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
