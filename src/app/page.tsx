'use client';

import { useState, useEffect } from 'react';
import {
	Tabs,
	TabList,
	Tab,
	TabPanels,
	TabPanel,
	DataTable,
	Table,
	TableHead,
	TableRow,
	TableHeader,
	TableBody,
	TableCell,
	Button,
	Modal,
	TextInput,
	TextArea,
	Form,
	Stack,
	InlineLoading,
	Tag,
	Tile,
} from '@carbon/react';
import { Add, DataTable as DataTableIcon, TestTool, Report } from '@carbon/icons-react';
import { api } from '@/lib/api';
import styles from './page.module.scss';
import { Agent, Test, TestResult } from '../../../backend/src/db/queries';

export default function Home() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalType, setModalType] = useState<'agent' | 'test' | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	// Data states
	const [agents, setAgents] = useState<Agent[]>([]);
	const [tests, setTests] = useState<Test[]>([]);
	const [results, setResults] = useState<TestResult[]>([]);
	const [formData, setFormData] = useState<Record<string, string>>({});

	// Fetch data
	const fetchData = async () => {
		setIsLoading(true);
		try {
			const [agentsData, testsData, resultsData] = await Promise.all([
				api.getAgents(),
				api.getTests(),
				api.getResults(),
			]);
			setAgents(agentsData);
			setTests(testsData);
			setResults(resultsData);
		} catch (error) {
			console.error('Error fetching data:', error);
		}
		setIsLoading(false);
	};

	useEffect(() => {
		fetchData();
	}, []);

	// Form handling
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setFormData({
			...formData,
			[e.target.id]: e.target.value,
		});
	};

	const handleSubmit = async () => {
		setIsSaving(true);
		try {
			if (modalType === 'agent') {
				await api.createAgent({
					name: formData['agent-name'],
					version: formData['agent-version'],
					prompt: formData['agent-prompt'],
					settings: formData['agent-settings'],
				});
			} else if (modalType === 'test') {
				await api.createTest({
					name: formData['test-name'],
					description: formData['test-description'],
					input: formData['test-input'],
					expected_output: formData['test-expected-output'],
				});
			}
			await fetchData();
			setIsModalOpen(false);
			setFormData({});
		} catch (error) {
			console.error('Error saving:', error);
		}
		setIsSaving(false);
	};

	// Table configurations
	const agentRows = agents.map((agent) => ({
		id: agent.id?.toString() || `agent-${Date.now()}`,
		name: agent.name,
		version: agent.version,
		created_at: new Date(agent.created_at!).toLocaleString(),
	}));

	const testRows = tests.map((test) => ({
		id: test.id?.toString() || `test-${Date.now()}`,
		name: test.name,
		description: test.description || '',
		created_at: new Date(test.created_at!).toLocaleString(),
	}));

	const resultRows = results.map((result) => ({
		id: result.id?.toString() || `result-${Date.now()}`,
		agent_name: agents.find(a => a.id === result.agent_id)?.name || 'Unknown',
		test_name: tests.find(t => t.id === result.test_id)?.name || 'Unknown',
		success: result.success,
		execution_time: result.execution_time || 0,
		created_at: new Date(result.created_at!).toLocaleString(),
	}));

	const agentHeaders = [
		{ key: 'name', header: 'Name' },
		{ key: 'version', header: 'Version' },
		{ key: 'created_at', header: 'Created At' },
	];

	const testHeaders = [
		{ key: 'name', header: 'Name' },
		{ key: 'description', header: 'Description' },
		{ key: 'created_at', header: 'Created At' },
	];

	const resultHeaders = [
		{ key: 'agent_name', header: 'Agent' },
		{ key: 'test_name', header: 'Test' },
		{ key: 'success', header: 'Success' },
		{ key: 'execution_time', header: 'Time (ms)' },
		{ key: 'created_at', header: 'Created At' },
	];

	const handleAddClick = (type: 'agent' | 'test') => {
		setModalType(type);
		setFormData({});
		setIsModalOpen(true);
	};

	interface TableCell {
		id: string;
		info: {
			header: string;
		};
		value: string | number | boolean;
	}

	const renderTable = (
		headers: Array<{ key: string; header: string }>,
		rows: Array<{ id: string;[key: string]: string | number | boolean }>
	) => (
		<DataTable rows={rows} headers={headers}>
			{({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
				<Table {...getTableProps()}>
					<TableHead>
						<TableRow>
							{headers.map((header, index) => (
								<TableHeader {...getHeaderProps({ header })} key={`${header.key}-${index}`}>
									{header.header}
								</TableHeader>
							))}
						</TableRow>
					</TableHead>
					<TableBody>
						{rows.map((row, rowIndex) => (
							<TableRow {...getRowProps({ row })} key={`${row.id}-${rowIndex}`}>
								{row.cells.map((cell: TableCell, cellIndex) => {
									if (cell.info.header === 'success') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<Tag type={cell.value ? 'green' : 'red'}>
													{cell.value ? 'Success' : 'Failed'}
												</Tag>
											</TableCell>
										);
									}
									return (
										<TableCell key={`${cell.id}-${cellIndex}`}>{cell.value}</TableCell>
									);
								})}
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</DataTable>
	);

	const EmptyState = ({
		title,
		description,
		icon: Icon,
		onAddClick
	}: {
		title: string;
		description: string;
		icon: React.ComponentType<{ size: number; className?: string }>;
		onAddClick: () => void;
	}) => (
		<Tile className={styles.emptyState}>
			<Icon size={32} className={styles.emptyStateIcon} />
			<h3>{title}</h3>
			<p>{description}</p>
			<Button
				renderIcon={Add}
				size="lg"
				onClick={onAddClick}
			>
				Add {title.split(' ')[0]}
			</Button>
		</Tile>
	);

	return (
		<>
			<Tabs>
				<TabList aria-label="Database Testing Tabs">
					<Tab>Agents</Tab>
					<Tab>Tests</Tab>
					<Tab>Results</Tab>
				</TabList>

				<TabPanels>
					<TabPanel>
						<div className={styles.panelHeader}>
							<h2>Agents</h2>
							{agentRows.length > 0 && (
								<Button
									renderIcon={Add}
									onClick={() => handleAddClick('agent')}
								>
									Add Agent
								</Button>
							)}
						</div>
						{isLoading ? (
							<InlineLoading description="Loading data..." />
						) : agentRows.length > 0 ? (
							renderTable(agentHeaders, agentRows)
						) : (
							<EmptyState
								title="Agent Configurations"
								description="Create your first AI agent configuration with custom prompts and settings."
								icon={DataTableIcon as React.ComponentType<{ size: number; className?: string }>}
								onAddClick={() => handleAddClick('agent')}
							/>
						)}
					</TabPanel>

					<TabPanel>
						<div className={styles.panelHeader}>
							<h2>Tests</h2>
							{testRows.length > 0 && (
								<Button
									renderIcon={Add}
									onClick={() => handleAddClick('test')}
								>
									Add Test
								</Button>
							)}
						</div>
						{isLoading ? (
							<InlineLoading description="Loading data..." />
						) : testRows.length > 0 ? (
							renderTable(testHeaders, testRows)
						) : (
							<EmptyState
								title="Test Cases"
								description="Add your first test case with input data and expected outputs."
								icon={TestTool as React.ComponentType<{ size: number; className?: string }>}
								onAddClick={() => handleAddClick('test')}
							/>
						)}
					</TabPanel>

					<TabPanel>
						<div className={styles.panelHeader}>
							<h2>Results</h2>
						</div>
						{isLoading ? (
							<InlineLoading description="Loading data..." />
						) : resultRows.length > 0 ? (
							renderTable(resultHeaders, resultRows)
						) : (
							<EmptyState
								title="Test Results"
								description="Run tests against your agents to see results here."
								icon={Report as React.ComponentType<{ size: number; className?: string }>}
								onAddClick={() => handleAddClick('test')}
							/>
						)}
					</TabPanel>
				</TabPanels>
			</Tabs>

			{/* Add/Edit Modal */}
			<Modal
				open={isModalOpen}
				modalHeading={`Add New ${modalType === 'agent' ? 'Agent' : 'Test'}`}
				primaryButtonText={isSaving ? 'Saving...' : 'Save'}
				secondaryButtonText="Cancel"
				onRequestClose={() => setIsModalOpen(false)}
				onRequestSubmit={handleSubmit}
				primaryButtonDisabled={isSaving}
			>
				<Form>
					<Stack gap={7}>
						{modalType === 'agent' ? (
							<>
								<TextInput
									id="agent-name"
									labelText="Name"
									placeholder="Enter agent name"
									value={formData['agent-name'] || ''}
									onChange={handleInputChange}
								/>
								<TextInput
									id="agent-version"
									labelText="Version"
									placeholder="Enter version"
									value={formData['agent-version'] || ''}
									onChange={handleInputChange}
								/>
								<TextArea
									id="agent-prompt"
									labelText="Prompt"
									placeholder="Enter agent prompt"
									rows={4}
									value={formData['agent-prompt'] || ''}
									onChange={handleInputChange}
								/>
								<TextArea
									id="agent-settings"
									labelText="Settings (JSON)"
									placeholder="Enter agent settings as JSON"
									rows={4}
									value={formData['agent-settings'] || ''}
									onChange={handleInputChange}
								/>
							</>
						) : (
							<>
								<TextInput
									id="test-name"
									labelText="Name"
									placeholder="Enter test name"
									value={formData['test-name'] || ''}
									onChange={handleInputChange}
								/>
								<TextInput
									id="test-description"
									labelText="Description"
									placeholder="Enter test description"
									value={formData['test-description'] || ''}
									onChange={handleInputChange}
								/>
								<TextArea
									id="test-input"
									labelText="Input"
									placeholder="Enter test input"
									rows={4}
									value={formData['test-input'] || ''}
									onChange={handleInputChange}
								/>
								<TextArea
									id="test-expected-output"
									labelText="Expected Output"
									placeholder="Enter expected output"
									rows={4}
									value={formData['test-expected-output'] || ''}
									onChange={handleInputChange}
								/>
							</>
						)}
					</Stack>
				</Form>
			</Modal>
		</>
	);
}
