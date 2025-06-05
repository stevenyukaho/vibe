'use client';

import React, { useEffect, useState } from 'react';
import { api, SuiteRun } from '../../lib/api';
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
	Modal
} from '@carbon/react';
import { ViewFilled, PlayFilled, TrashCan } from '@carbon/icons-react';
import { useRouter } from 'next/navigation';

export default function SuiteRunsPage() {
	const [runs, setRuns] = useState<SuiteRun[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [rerunningId, setRerunningId] = useState<number | null>(null);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	
	// Modal state
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [deleteRunId, setDeleteRunId] = useState<number | null>(null);
	const [isRerunModalOpen, setIsRerunModalOpen] = useState(false);
	const [rerunRunId, setRerunRunId] = useState<number | null>(null);
	
	const router = useRouter();

	const fetchRuns = async () => {
		try {
			const data = await api.getSuiteRuns();
			setRuns(data);
		} catch (err: unknown) {
			if (err instanceof Error) setError(err.message);
			else setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		let mounted = true;
		async function loadData() {
			try {
				const data = await api.getSuiteRuns();
				if (mounted) setRuns(data);
			} catch (err: unknown) {
				if (mounted) {
					if (err instanceof Error) setError(err.message);
					else setError(String(err));
				}
			} finally {
				if (mounted) setLoading(false);
			}
		}
		loadData();
		const interval = setInterval(loadData, 2000);
		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, []);

	const handleViewRun = (id: number) => {
		router.push(`/suite-runs/${id}`);
	};

	const handleRerunSuiteOpen = (id: number) => {
		setRerunRunId(id);
		setIsRerunModalOpen(true);
	};

	const handleRerunSuiteConfirm = async () => {
		if (!rerunRunId) return;
		
		setRerunningId(rerunRunId);
		setError(null);
		setSuccessMessage(null);
		
		try {
			const result = await api.rerunSuiteRun(rerunRunId);
			setSuccessMessage(`Suite run started successfully with ID ${result.suite_run_id}`);
			fetchRuns();
		} catch (err) {
			if (err instanceof Error) setError(err.message);
			else setError(String(err));
		} finally {
			setRerunningId(null);
			setIsRerunModalOpen(false);
		}
	};

	const handleDeleteSuiteRunOpen = (id: number) => {
		setDeleteRunId(id);
		setIsDeleteModalOpen(true);
	};

	const handleDeleteSuiteRunConfirm = async () => {
		if (!deleteRunId) return;
		
		setDeletingId(deleteRunId);
		setError(null);
		setSuccessMessage(null);
		
		try {
			await api.deleteSuiteRun(deleteRunId);
			setSuccessMessage('Suite run deleted successfully');
			fetchRuns();
		} catch (err) {
			if (err instanceof Error) setError(err.message);
			else setError(String(err));
		} finally {
			setDeletingId(null);
			setIsDeleteModalOpen(false);
		}
	};

	if (loading)
	{
		return <InlineLoading description="Loading suite runs..." />;
	}
	if (error) {
		return <InlineNotification kind="error" title="Error" subtitle={error} hideCloseButton />;
	}

	const headers = [
		{ key: 'id', header: 'ID' },
		{ key: 'agent_name', header: 'Agent' },
		{ key: 'status', header: 'Status' },
		{ key: 'progress', header: 'Progress' },
		{ key: 'total_execution_time', header: 'Total execution time' },
		{ key: 'success_rate', header: 'Success rate' },
		{ key: 'actions', header: 'Actions' }
	];

	const getRowActions = (rowId: string) => {
		const run = runs.find(run => String(run.id) === rowId);
		if (!run) return null;
		
		return (
			<div style={{ display: 'flex', gap: '0.5rem' }}>
				<Button 
					kind="ghost" 
					size="sm" 
					renderIcon={ViewFilled} 
					onClick={() => handleViewRun(run.id)}
					iconDescription="View suite run details"
					hasIconOnly
				/>
				<Button 
					kind="ghost" 
					size="sm" 
					renderIcon={PlayFilled} 
					onClick={() => handleRerunSuiteOpen(run.id)}
					iconDescription="Re-run this suite"
					disabled={rerunningId === run.id}
					hasIconOnly
				/>
				<Button 
					kind="danger--ghost" 
					size="sm" 
					renderIcon={TrashCan} 
					onClick={() => handleDeleteSuiteRunOpen(run.id)}
					iconDescription="Delete this suite run"
					disabled={deletingId === run.id}
					hasIconOnly
				/>
			</div>
		);
	};

	const rows = runs.map((run) => {
		// Calculate Total Execution Time in seconds (sum of individual test times)
		const totalMs = typeof run.total_execution_time === 'number' ? run.total_execution_time : 0;
		const totalExecutionTimeSec = totalMs / 1000;

		// Calculate Success Rate
		const successfulTests = typeof run.successful_tests === 'number' ? run.successful_tests : 0;
		const successRate = run.total_tests > 0
			? (successfulTests / run.total_tests) * 100
			: null;

		return {
			id: String(run.id),
			agent_name: run.agent_name, // Add agent_name to the row data
			status: run.status,
			progress: `${run.progress}% (${run.completed_tests}/${run.total_tests})`,
			total_execution_time: totalExecutionTimeSec > 0 ? `${totalExecutionTimeSec.toFixed(2)}s` : 'N/A',
			success_rate: successRate !== null ? `${successRate.toFixed(1)}%` : 'N/A',
			actions: getRowActions(String(run.id))
		};
	});

	return (
		<>
			<Grid>
				<Column sm={4} md={8} lg={16}>
					<h1>Suite runs</h1>
					{successMessage && (
						<InlineNotification
							kind="success"
							title="Success"
							subtitle={successMessage}
							hideCloseButton={false}
							onCloseButtonClick={() => setSuccessMessage(null)}
							style={{ marginBottom: '1rem' }}
						/>
					)}
					{error && (
						<InlineNotification
							kind="error"
							title="Error"
							subtitle={error}
							hideCloseButton={false}
							onCloseButtonClick={() => setError(null)}
							style={{ marginBottom: '1rem' }}
						/>
					)}
					{runs.length === 0 ? (
						<p>No suite runs available.</p>
					) : (
						<DataTable rows={rows} headers={headers}>
							{({ rows, headers, getHeaderProps, getTableProps }) => (
								<Table {...getTableProps()}>
									<TableHead>
										<TableRow>
											{headers.map((header, index) => (
												<TableHeader {...getHeaderProps({ header })} key={`header-${header.key}-${index}`}>
													{header.header}
												</TableHeader>
											))}
										</TableRow>
									</TableHead>
									<TableBody>
										{rows.map((row) => (
											<TableRow key={row.id}>
												{row.cells.map((cell) => {
													if (cell.info.header === 'status') {
														const tagType = cell.value === 'completed' 
															? 'green' 
															: cell.value === 'running' 
																? 'blue' 
																: 'gray';
														return (
															<TableCell key={`${row.id}-${cell.id}`}>
																<Tag type={tagType}>{cell.value}</Tag>
															</TableCell>
														);
													}
													if (cell.info.header === 'actions') {
														return <TableCell key={`${row.id}-actions`}>{getRowActions(row.id)}</TableCell>;
													}
													return <TableCell key={`${row.id}-${cell.id}`}>{cell.value}</TableCell>;
												})}
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</DataTable>
					)}
				</Column>
			</Grid>
			
			{/* Delete Confirmation Modal */}
			<Modal
				open={isDeleteModalOpen}
				modalHeading="Delete Suite Run"
				primaryButtonText={deletingId !== null ? 'Deleting...' : 'Delete'}
				secondaryButtonText="Cancel"
				onRequestClose={() => setIsDeleteModalOpen(false)}
				onRequestSubmit={handleDeleteSuiteRunConfirm}
				primaryButtonDisabled={deletingId !== null}
				danger
			>
				<p>Are you sure you want to delete this suite run? This will permanently remove it and all associated data.</p>
			</Modal>
			
			{/* Re-run Confirmation Modal */}
			<Modal
				open={isRerunModalOpen}
				modalHeading="Re-run Suite"
				primaryButtonText={rerunningId !== null ? 'Starting...' : 'Run'}
				secondaryButtonText="Cancel"
				onRequestClose={() => setIsRerunModalOpen(false)}
				onRequestSubmit={handleRerunSuiteConfirm}
				primaryButtonDisabled={rerunningId !== null}
			>
				<p>Are you sure you want to re-run this test suite? This will create a new suite run with the same agent and tests.</p>
			</Modal>
		</>
	);
}
