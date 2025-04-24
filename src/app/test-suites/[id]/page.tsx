'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, TestSuite, Test, Agent } from '../../../lib/api';
import {
	TableContainer,
	Table,
	TableHead,
	TableRow,
	TableHeader,
	TableBody,
	TableCell,
	Button,
	InlineLoading,
	Dropdown,
	FormLabel,
	Tile,
	Grid,
	Column,
	Stack,
	InlineNotification
} from '@carbon/react';
import { ChevronLeft, TrashCan, Rocket, Add } from '@carbon/icons-react';

interface PageProps {
	params: { id: string };
}

export default function TestSuiteDetailPage({ params }: PageProps) {
	const { id } = params;
	const suiteId = parseInt(id, 10);

	const [suite, setSuite] = useState<TestSuite | null>(null);
	const [tests, setTests] = useState<Test[]>([]);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [allTests, setAllTests] = useState<Test[]>([]);
	const [selectedTestToAdd, setSelectedTestToAdd] = useState<number | ''>('');
	const [isRunning, setIsRunning] = useState(false);
	const router = useRouter();

	useEffect(() => {
		async function fetchData() {
			try {
				const allSuites = await api.getTestSuites();
				const found = allSuites.find((s) => s.id === suiteId);
				if (!found) {
					throw new Error('Test suite not found');
				}
				setSuite(found);

				const [testsData, agentsData, allTestsData] = await Promise.all([
					api.getTestsInSuite(suiteId),
					api.getAgents(),
					api.getTests()
				]);
				setTests(testsData);
				setAgents(agentsData);
				setAllTests(allTestsData);
				if (agentsData.length > 0) {
					setSelectedAgentId(agentsData[0].id ?? null);
				}
			} catch (err: unknown) {
				if (err instanceof Error) {
					setError(err.message);
				} else {
					setError(String(err));
				}
			} finally {
				setLoading(false);
			}
		}

		fetchData();
	}, [suiteId]);

	if (loading) {
		return <InlineLoading description="Loading suite details..." />;
	}
	if (error) {
		return <InlineNotification kind="error" title="Error" subtitle={error} hideCloseButton />;
	}
	if (!suite) {
		return <InlineNotification kind="error" title="Error" subtitle="Suite not found." hideCloseButton />;
	}

	const handleRunSuite = async () => {
		if (!selectedAgentId) {
			setError('Please select an agent');
			return;
		}
		try {
			setIsRunning(true);
			const { suite_run_id } = await api.executeSuite(suite.id, selectedAgentId);
			router.push(`/suite-runs/${suite_run_id}`);
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError(String(err));
			}
			setIsRunning(false);
		}
	};

	const handleAddTest = async () => {
		if (selectedTestToAdd === '') {
			return;
		}
		
		try {
			await api.addTestToSuite(suite!.id, selectedTestToAdd);
			const updated = await api.getTestsInSuite(suite!.id);
			setTests(updated);
			setSelectedTestToAdd('');
			setError(null);
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError(String(err));
			}
		}
	};

	const handleRemoveTest = async (testId: number) => {
		try {
			await api.removeTestFromSuite(suite!.id, testId);
			const updated = await api.getTestsInSuite(suite!.id);
			setTests(updated);
			setError(null);
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError(String(err));
			}
		}
	};

	// Get list of tests that are not already in the test suite
	const availableTests = allTests.filter(
		(t) => !tests.some((st) => st.id === t.id)
	);

	return (
		<Grid>
			<Column sm={4} md={8} lg={16}>
				<Stack gap={7}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<h1>{suite.name}</h1>
						<Button
							kind="primary"
							onClick={handleRunSuite}
							disabled={!selectedAgentId || isRunning}
							renderIcon={Rocket}
						>
							{isRunning ? 'Running...' : 'Run Suite'}
						</Button>
					</div>
					
					{suite.description && (
						<p>{suite.description}</p>
					)}
					
					<Tile>
						<h3>Run Configuration</h3>
						<div style={{ marginTop: '1rem' }}>
							<FormLabel>Choose Agent:</FormLabel>
							<Dropdown
								id="agent-select"
								titleText=""
								label="Select agent"
								items={agents.map(agent => ({
									id: String(agent.id),
									label: `${agent.name} v${agent.version}`
								}))}
								selectedItem={selectedAgentId ? {
									id: String(selectedAgentId),
									label: agents.find(a => a.id === selectedAgentId)
										? `${agents.find(a => a.id === selectedAgentId)!.name} v${agents.find(a => a.id === selectedAgentId)!.version}`
										: 'Select agent'
								} : undefined}
								onChange={({ selectedItem }) => selectedItem && setSelectedAgentId(parseInt(selectedItem.id, 10))}
								style={{ maxWidth: '300px' }}
							/>
						</div>
					</Tile>
					
					<div>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
							<h2>Tests</h2>
							<div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
								<Dropdown
									id="add-test-select"
									titleText=""
									label="Select test to add"
									disabled={availableTests.length === 0}
									items={availableTests.map(test => ({
										id: String(test.id),
										label: test.name
									}))}
									selectedItem={selectedTestToAdd ? {
										id: String(selectedTestToAdd),
										label: allTests.find(t => t.id === selectedTestToAdd)?.name || ''
									} : undefined}
									onChange={({ selectedItem }) => selectedItem && setSelectedTestToAdd(parseInt(selectedItem.id, 10))}
								/>
								<Button
									kind="secondary"
									size="sm"
									onClick={handleAddTest}
									disabled={selectedTestToAdd === ''}
									renderIcon={Add}
								>
									Add Test
								</Button>
							</div>
						</div>
						
						{tests.length > 0 ? (
							<TableContainer title="Tests">
								<Table>
									<TableHead>
										<TableRow>
											<TableHeader>Name</TableHeader>
											<TableHeader>Description</TableHeader>
											<TableHeader>Actions</TableHeader>
										</TableRow>
									</TableHead>
									<TableBody>
										{tests.map((test) => (
											<TableRow key={test.id}>
												<TableCell>{test.name}</TableCell>
												<TableCell>{test.description || '-'}</TableCell>
												<TableCell>
													<Button
														kind="ghost"
														size="sm"
														hasIconOnly
														renderIcon={TrashCan}
														iconDescription="Remove test"
														tooltipPosition="left"
														onClick={() => handleRemoveTest(test.id!)}
													/>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
						) : (
							<Tile>
								<p>No tests have been added to this suite yet. Use the dropdown above to add tests.</p>
							</Tile>
						)}
					</div>
					
					<div>
						<Link href="/test-suites" passHref>
							<Button
								kind="ghost"
								renderIcon={ChevronLeft}
							>
								Back to Test Suites
							</Button>
						</Link>
					</div>
				</Stack>
			</Column>
		</Grid>
	);
}
