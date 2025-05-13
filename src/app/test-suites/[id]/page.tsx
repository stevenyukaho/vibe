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
import { ChevronLeft, Rocket, ArrowRight, ArrowLeft } from '@carbon/icons-react';

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
		if (tests.length === 0) {
			setError('Cannot run an empty suite. Please add tests.');
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

	const handleAddTestToSuiteTable = async (testId: number) => {
		if (!suite) {
			return;
		}
		try {
			await api.addTestToSuite(suite.id, testId);
			const updatedTestsInSuite = await api.getTestsInSuite(suite.id);
			setTests(updatedTestsInSuite);
			setError(null);
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError(String(err));
			}
		}
	};

	const handleRemoveTestFromSuiteTable = async (testId: number) => {
		if (!suite) {
			return;
		}
		try {
			await api.removeTestFromSuite(suite.id, testId);
			const updatedTestsInSuite = await api.getTestsInSuite(suite.id);
			setTests(updatedTestsInSuite);
			setError(null);
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError(String(err));
			}
		}
	};

	const availableTestsToDisplay = allTests.filter(
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
							disabled={!selectedAgentId || isRunning || tests.length === 0}
							renderIcon={Rocket}
						>
							{isRunning ? 'Running...' : 'Run Suite'}
						</Button>
					</div>

					<div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '-1rem', marginTop: '-1rem' }}>
						<Link href="/test-suites" passHref>
							<Button
								kind="ghost"
								renderIcon={ChevronLeft}
							>
								Back to Test Suites
							</Button>
						</Link>
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
					
					<h2>Tests</h2>
					{error && (
						<InlineNotification
							kind="error"
							title="Error modifying tests"
							subtitle={error}
							onCloseButtonClick={() => setError(null)}
							style={{ marginBottom: '1rem' }}
							hideCloseButton={false}
						/>
					)}
					<Grid>
						<Column md={4} lg={8} sm={4} className="cds--col-padding">
							<Tile style={{ height: '100%' }}>
								<h4>Available Tests ({availableTestsToDisplay.length})</h4>
								{availableTestsToDisplay.length > 0 ? (
									<TableContainer>
										<Table size="sm" useZebraStyles={false}>
											<TableHead>
												<TableRow>
													<TableHeader>Name</TableHeader>
													<TableHeader>Description</TableHeader>
													<TableHeader style={{ width: '50px' }}>Action</TableHeader>
												</TableRow>
											</TableHead>
											<TableBody>
												{availableTestsToDisplay.map((test) => (
													<TableRow key={`available-${test.id}`}>
														<TableCell>{test.name}</TableCell>
														<TableCell>{test.description || '-'}</TableCell>
														<TableCell>
															<Button
																kind="ghost"
																size="sm"
																hasIconOnly
																renderIcon={ArrowRight}
																iconDescription="Add to suite"
																tooltipPosition="left"
																onClick={() => handleAddTestToSuiteTable(test.id!)}
															/>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</TableContainer>
								) : (
									<p style={{paddingTop: '1rem'}}>No other tests available to add.</p>
								)}
							</Tile>
						</Column>

						<Column md={4} lg={8} sm={4} className="cds--col-padding">
							<Tile style={{ height: '100%' }}>
								<h4>Tests in Suite ({tests.length})</h4>
								{tests.length > 0 ? (
									<TableContainer>
										<Table size="sm" useZebraStyles={false}>
											<TableHead>
												<TableRow>
													<TableHeader style={{ width: '50px' }}>Action</TableHeader>
													<TableHeader>Name</TableHeader>
													<TableHeader>Description</TableHeader>
												</TableRow>
											</TableHead>
											<TableBody>
												{tests.map((test) => (
													<TableRow key={`suite-${test.id}`}>
														<TableCell>
															<Button
																kind="ghost"
																size="sm"
																hasIconOnly
																renderIcon={ArrowLeft}
																iconDescription="Remove from suite"
																tooltipPosition="right"
																onClick={() => handleRemoveTestFromSuiteTable(test.id!)}
															/>
														</TableCell>
														<TableCell>{test.name}</TableCell>
														<TableCell>{test.description || '-'}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</TableContainer>
								) : (
									<p style={{paddingTop: '1rem'}}>No tests have been added to this suite. Add tests from the &quot;Available Tests&quot; list.</p>
								)}
							</Tile>
						</Column>
					</Grid>
				</Stack>
			</Column>
		</Grid>
	);
}
