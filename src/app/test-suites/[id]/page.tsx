'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, TestSuite, Test, Agent, SuiteEntry } from '../../../lib/api';
import {
	Button,
	Column,
	FormLabel,
	Grid,
	IconButton,
	InlineLoading,
	InlineNotification,
	Search,
	Select,
	SelectItem,
	Stack,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableHeader,
	TableRow,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Tag,
	Tile,
	Tooltip
} from '@carbon/react';
import { 
	ChevronLeft, 
	Rocket, 
	Add, 
	ArrowRight, 
	ArrowLeft 
} from '@carbon/icons-react';
import styles from '../TestSuites.module.scss';

interface PageProps {
	params: { id: string };
}

interface AvailableItem {
	id: number;
	name: string;
	type: 'test' | 'suite';
	description?: string;
}

export default function TestSuiteDetailPage({ params }: PageProps) {
	const { id } = params;
	const suiteId = parseInt(id, 10);

	const [suite, setSuite] = useState<TestSuite | null>(null);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [allTests, setAllTests] = useState<Test[]>([]);
	const [allSuites, setAllSuites] = useState<TestSuite[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [entries, setEntries] = useState<SuiteEntry[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [activeTab, setActiveTab] = useState(0);
	
	// Track agent selections for available items
	const [availableItemAgents, setAvailableItemAgents] = useState<Record<string, number | null>>({});

	const router = useRouter();

	useEffect(() => {
		async function fetchData() {
			try {
				const allSuitesData = await api.getTestSuites();
				const found = allSuitesData.find((s) => s.id === suiteId);
				if (!found) {
					throw new Error('Test suite not found');
				}
				setSuite(found);
				setAllSuites(allSuitesData.filter(s => s.id !== suiteId));

				const [agentsData, allTestsData, entriesData] = await Promise.all([
					api.getAgents(),
					api.getTests(),
					api.getSuiteEntries(suiteId)
				]);
				
				setAgents(agentsData);
				setAllTests(allTestsData);
				setEntries(entriesData);
				
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
		if (entries.length === 0) {
			setError('Cannot run an empty suite. Please add entries.');
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

	const handleAddEntry = async (item: AvailableItem) => {
		const itemKey = `${item.type}-${item.id}`;
		const agentOverride = availableItemAgents[itemKey];
		
		const entryPayload: { sequence: number; test_id?: number; child_suite_id?: number; agent_id_override?: number } = { 
			sequence: entries.length 
		};
		
		if (item.type === 'test') {
			entryPayload.test_id = item.id;
		} else {
			entryPayload.child_suite_id = item.id;
		}
		
		if (agentOverride) {
			entryPayload.agent_id_override = agentOverride;
		}

		try {
			const newEntry = await api.addSuiteEntry(suiteId, entryPayload);
			setEntries(prev => [...prev, newEntry]);
			// Reset the agent selection for this item
			setAvailableItemAgents(prev => ({ ...prev, [itemKey]: null }));
			setError(null);
		} catch (e: unknown) {
			if (e instanceof Error) {
				setError(e.message);
			}
		}
	};

	const handleDeleteEntry = async (entryId: number) => {
		try {
			await api.deleteSuiteEntry(suiteId, entryId);
			setEntries(prev => prev.filter(e => e.id !== entryId));
			setError(null);
		} catch (e: unknown) {
			if (e instanceof Error) {
				setError(e.message);
			}
		}
	};

	const handleUpdateEntryAgent = async (entryId: number, agentId: number | null) => {
		try {
			await api.updateSuiteEntry(suiteId, entryId, { agent_id_override: agentId || undefined });
			setEntries(prev => prev.map(e => 
				e.id === entryId 
					? { ...e, agent_id_override: agentId || undefined }
					: e
			));
			setError(null);
		} catch (e: unknown) {
			let message = 'An unknown error occurred';
			if (e instanceof Error) {
				message = e.message;
			} else if (typeof e === 'string') {
				message = e;
			}
			setError(`Failed to update entry agent: ${message}`);
			console.error(e);
		}
	};

	const getEntryName = (entry: SuiteEntry): string => {
		if (entry.test_id) {
			const test = allTests.find(t => t.id === entry.test_id);
			return test ? test.name : `Test #${entry.test_id}`;
		} else if (entry.child_suite_id) {
			const childSuite = allSuites.find(s => s.id === entry.child_suite_id);
			return childSuite ? childSuite.name : `Suite #${entry.child_suite_id}`;
		}
		return 'Unknown Entry';
	};

	// Filter available tests and suites
	const usedTestIds = new Set(entries.filter(e => e.test_id).map(e => e.test_id!));
	const usedSuiteIds = new Set(entries.filter(e => e.child_suite_id).map(e => e.child_suite_id!));
	
	const availableTests: AvailableItem[] = allTests
		.filter(t => t.id != null && !usedTestIds.has(t.id))
		.map(t => ({ id: t.id!, name: t.name, type: 'test', description: t.description }));
	
	const availableSuites: AvailableItem[] = allSuites
		.filter(s => !usedSuiteIds.has(s.id!))
		.map(s => ({ id: s.id!, name: s.name, type: 'suite', description: s.description }));

	// Filter items based on search and active tab
	const getFilteredItems = () => {
		const allItems = activeTab === 0 ? availableTests : availableSuites;
		if (!searchTerm) return allItems;
		return allItems.filter(item => 
			item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
		);
	};

	const filteredItems = getFilteredItems();

	// Create agent select options
	const agentSelectOptions = [
		{ id: 'default', label: 'Use suite default' },
		...agents.map(agent => ({
			id: String(agent.id),
			label: `${agent.name} v${agent.version}`
		}))
	];

	return (
		<Grid>
			<Column sm={4} md={8} lg={16}>
				<Stack gap={7}>
					<div className={styles.header}>
						<h1>{suite.name}</h1>
						<Button
							kind="primary"
							onClick={handleRunSuite}
							disabled={!selectedAgentId || isRunning || entries.length === 0}
							renderIcon={Rocket}
						>
							{isRunning ? 'Running...' : 'Run Suite'}
						</Button>
					</div>

					<div className={styles.backButton}>
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
					
					<Tile className={styles.runConfigTile}>
						<h3>Run Configuration</h3>
						<div className={styles.agentSelect}>
							<FormLabel>Choose Agent:</FormLabel>
							<Select
								id="agent-select"
								labelText=""
								value={selectedAgentId ? String(selectedAgentId) : ''}
								onChange={(e) => setSelectedAgentId(parseInt(e.target.value, 10))}
							>
								{agents.map(agent => (
									<SelectItem key={agent.id} value={String(agent.id)} text={`${agent.name} v${agent.version}`} />
								))}
							</Select>
						</div>
					</Tile>

					{error && <InlineNotification kind="error" title="Error" subtitle={error} onCloseButtonClick={() => setError(null)} />}
					
					{/* Dual Panel Interface */}
					<Grid className={styles.dualPanelGrid}>
						{/* Available Items Panel */}
						<Column sm={2} md={4} lg={8}>
							<Tile className={styles.panelTile}>
								<div className={styles.panelHeader}>
									<h3>Available Items</h3>
								</div>
								
								<Search
									id="search-available"
									labelText="Search available items"
									placeholder="Search available items..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									size="sm"
									className={styles.searchContainer}
								/>

								<Tabs selectedIndex={activeTab} onChange={({ selectedIndex }) => setActiveTab(selectedIndex)}>
									<TabList>
										<Tab>Tests ({availableTests.length})</Tab>
										<Tab>Suites ({availableSuites.length})</Tab>
									</TabList>
									<TabPanels>
										<TabPanel style={{ padding: 0 }}>
											<div className={styles.scrollableTable}>
												{filteredItems.length > 0 ? (
													<TableContainer>
														<Table size="sm">
															<TableHead>
																<TableRow>
																	<TableHeader>Name</TableHeader>
																	<TableHeader>Agent Override</TableHeader>
																	<TableHeader>Action</TableHeader>
																</TableRow>
															</TableHead>
															<TableBody>
																{filteredItems.map((item) => {
																	const itemKey = `${item.type}-${item.id}`;
																	return (
																		<TableRow key={itemKey}>
																			<TableCell>
																				<div>
																					<div className={styles.entryName}>{item.name}</div>
																					{item.description && (
																						<div className={styles.itemDescription}>
																							{item.description}
																						</div>
																					)}
																				</div>
																			</TableCell>
																			<TableCell>
																				<Select
																					id={`agent-${itemKey}`}
																					labelText=""
																					size="sm"
																					value={availableItemAgents[itemKey] ? String(availableItemAgents[itemKey]) : 'default'}
																					onChange={(e) => {
																						const agentId = e.target.value !== 'default' 
																							? parseInt(e.target.value, 10) 
																							: null;
																						setAvailableItemAgents(prev => ({ 
																							...prev, 
																							[itemKey]: agentId 
																						}));
																					}}
																					className={styles.agentOverrideSelect}
																				>
																					{agentSelectOptions.map(item => (
																						<SelectItem key={item.id} value={item.id} text={item.label} />
																					))}
																				</Select>
																			</TableCell>
																			<TableCell>
																				<Tooltip content="Add to suite">
																					<IconButton
																						kind="ghost"
																						size="sm"
																						label="Add to suite"
																						onClick={() => handleAddEntry(item)}
																					>
																						<ArrowRight size={16} />
																					</IconButton>
																				</Tooltip>
																			</TableCell>
																		</TableRow>
																	);
																})}
															</TableBody>
														</Table>
													</TableContainer>
												) : (
													<div className={styles.emptyState}>
														{searchTerm ? 'No items match your search' : `No available ${activeTab === 0 ? 'tests' : 'suites'}`}
													</div>
												)}
											</div>
										</TabPanel>
										<TabPanel style={{ padding: 0 }}>
											<div className={styles.scrollableTable}>
												{filteredItems.length > 0 ? (
													<TableContainer>
														<Table size="sm">
															<TableHead>
																<TableRow>
																	<TableHeader>Name</TableHeader>
																	<TableHeader>Agent Override</TableHeader>
																	<TableHeader>Action</TableHeader>
																</TableRow>
															</TableHead>
															<TableBody>
																{filteredItems.map((item) => {
																	const itemKey = `${item.type}-${item.id}`;
																	return (
																		<TableRow key={itemKey}>
																			<TableCell>
																				<div>
																					<div className={styles.entryName}>{item.name}</div>
																					{item.description && (
																						<div className={styles.itemDescription}>
																							{item.description}
																						</div>
																					)}
																				</div>
																			</TableCell>
																			<TableCell>
																				<Select
																					id={`agent-${itemKey}`}
																					labelText=""
																					size="sm"
																					value={availableItemAgents[itemKey] ? String(availableItemAgents[itemKey]) : 'default'}
																					onChange={(e) => {
																						const agentId = e.target.value !== 'default' 
																							? parseInt(e.target.value, 10) 
																							: null;
																						setAvailableItemAgents(prev => ({ 
																							...prev, 
																							[itemKey]: agentId 
																						}));
																					}}
																					className={styles.agentOverrideSelect}
																				>
																					{agentSelectOptions.map(item => (
																						<SelectItem key={item.id} value={item.id} text={item.label} />
																					))}
																				</Select>
																			</TableCell>
																			<TableCell>
																				<Tooltip content="Add to suite">
																					<IconButton
																						kind="ghost"
																						size="sm"
																						label="Add to suite"
																						onClick={() => handleAddEntry(item)}
																					>
																						<ArrowRight size={16} />
																					</IconButton>
																				</Tooltip>
																			</TableCell>
																		</TableRow>
																	);
																})}
															</TableBody>
														</Table>
													</TableContainer>
												) : (
													<div className={styles.emptyState}>
														{searchTerm ? 'No items match your search' : `No available ${activeTab === 0 ? 'tests' : 'suites'}`}
													</div>
												)}
											</div>
										</TabPanel>
									</TabPanels>
								</Tabs>
							</Tile>
						</Column>

						{/* Suite Entries Panel */}
						<Column sm={2} md={4} lg={8}>
							<Tile className={styles.panelTile}>
								<div className={styles.panelHeader}>
									<h3>Suite Entries ({entries.length})</h3>
								</div>

								{entries.length === 0 ? (
									<div className={styles.emptyStateWithIcon}>
										<Add size={32} />
										<p>No entries in this suite yet.</p>
										<p>Use the arrow buttons to add tests or suites from the left panel.</p>
									</div>
								) : (
									<div className={styles.scrollableEntries}>
										<TableContainer>
											<Table size="sm">
												<TableHead>
													<TableRow>
														<TableHeader>Actions</TableHeader>
														<TableHeader>Type</TableHeader>
														<TableHeader>Name</TableHeader>
														<TableHeader>Agent Override</TableHeader>
													</TableRow>
												</TableHead>
												<TableBody>
													{entries.map((entry) => (
														<TableRow key={entry.id}>
															<TableCell>
																<Tooltip content="Remove from suite">
																	<IconButton
																		kind="ghost"
																		size="sm"
																		label="Remove from suite"
																		onClick={() => handleDeleteEntry(entry.id)}
																	>
																		<ArrowLeft size={16} />
																	</IconButton>
																</Tooltip>
															</TableCell>
															<TableCell>
																{entry.test_id ? (
																	<Tag type="blue" size="sm">Test</Tag>
																) : (
																	<Tag type="green" size="sm">Suite</Tag>
																)}
															</TableCell>
															<TableCell>
																<div className={styles.entryName}>
																	{getEntryName(entry)}
																</div>
															</TableCell>
															<TableCell>
																<Select
																	id={`entry-agent-${entry.id}`}
																	labelText=""
																	size="sm"
																	value={entry.agent_id_override ? String(entry.agent_id_override) : 'default'}
																	onChange={(e) => {
																		const agentId = e.target.value !== 'default' 
																			? parseInt(e.target.value, 10) 
																			: null;
																		handleUpdateEntryAgent(entry.id, agentId);
																	}}
																	className={styles.entryAgentSelect}
																>
																	{agentSelectOptions.map(item => (
																		<SelectItem key={item.id} value={item.id} text={item.label} />
																	))}
																</Select>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</TableContainer>
									</div>
								)}
							</Tile>
						</Column>
					</Grid>
				</Stack>
			</Column>
		</Grid>
	);
}
