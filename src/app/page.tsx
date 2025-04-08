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
	CodeSnippet,
	RadioButtonGroup,
	RadioButton,
	InlineNotification,
} from '@carbon/react';
import { Add, DataTable as DataTableIcon, TestTool, Report, Edit, TrashCan, Launch } from '@carbon/icons-react';
import { api } from '@/lib/api';
import styles from './page.module.scss';
import { Agent, Test, TestResult } from '@/lib/api';
import TestExecutor from './components/TestExecutor';
import JobsManager from './components/JobsManager';

interface AgentSettings {
	type?: 'crew_ai' | 'external_api';
	base_url?: string;
	model?: string;
	role?: string;
	goal?: string;
	backstory?: string;
	temperature?: number;
	max_tokens?: number;
	// External API properties
	api_endpoint?: string;
	api_key?: string;
	request_template?: string;
	response_mapping?: string;
	headers?: Record<string, string>;
}

export default function Home() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalType, setModalType] = useState<'agent' | 'test' | 'result' | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<number | null>(null);

	// Data states
	const [agents, setAgents] = useState<Agent[]>([]);
	const [tests, setTests] = useState<Test[]>([]);
	const [results, setResults] = useState<TestResult[]>([]);
	const [formData, setFormData] = useState<Record<string, string>>({});

	// Delete states
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [deleteType, setDeleteType] = useState<'agent' | 'test' | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [deleteName, setDeleteName] = useState('');
	const [isDeleting, setIsDeleting] = useState(false);

	// Add a new state for the test connection
	const [testConnectionStatus, setTestConnectionStatus] = useState<{
		loading: boolean;
		success?: boolean;
		message?: string;
	} | null>(null);

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
		setError(null);
		try {
			if (modalType === 'agent') {
				// Parse existing settings or create new empty object
				let settings: AgentSettings = {};
				try {
					if (formData['agent-settings']) {
						settings = JSON.parse(formData['agent-settings']);
					}
				} catch (error) {
					// JSON parsing error
					console.error('Error parsing agent settings:', error);
					setError('Invalid JSON in settings field');
					setIsSaving(false);
					return;
				}
				
				// Set agent type
				settings.type = formData['agent-type'] === 'external_api' ? 'external_api' : 'crew_ai';
				
				// Validate required fields based on agent type
				if (settings.type === 'external_api') {
					// API endpoint is required for external API agents
					if (!formData['agent-api-endpoint']) {
						setError('API Endpoint is required for External API agents');
						setIsSaving(false);
						return;
					}
					
					// Validate API endpoint URL format
					try {
						new URL(formData['agent-api-endpoint']);
					} catch (error) {
						console.error('Invalid URL format:', error);
						setError('Invalid API Endpoint URL format');
						setIsSaving(false);
						return;
					}
					
					// Validate request template JSON if provided
					if (formData['agent-request-template']) {
						try {
							// Make sure it contains the input placeholder
							const template = formData['agent-request-template'];
							if (!template.includes('{{input}}')) {
								setError('Request template must include {{input}} placeholder');
								setIsSaving(false);
								return;
							}
							
							// Verify it's valid JSON when the placeholder is replaced
							JSON.parse(template.replace(/\{\{input\}\}/g, 'test'));
						} catch (error) {
							console.error('Invalid JSON in request template:', error);
							setError('Invalid JSON in request template');
							setIsSaving(false);
							return;
						}
					}
					
					// Validate response mapping JSON if provided
					if (formData['agent-response-mapping']) {
						try {
							const mapping = JSON.parse(formData['agent-response-mapping']);
							
							// Verify it has at least an output field
							if (!mapping.output) {
								setError('Response mapping must include an "output" field');
								setIsSaving(false);
								return;
							}
						} catch (error) {
							console.error('Invalid JSON in response mapping:', error);
							setError('Invalid JSON in response mapping');
							setIsSaving(false);
							return;
						}
					}
					
					// Validate headers JSON if provided
					if (formData['agent-headers']) {
						try {
							const headers = JSON.parse(formData['agent-headers']);
							
							// Verify it's an object
							if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
								setError('Headers must be a valid JSON object');
								setIsSaving(false);
								return;
							}
						} catch (error) {
							console.error('Invalid JSON in headers:', error);
							setError('Invalid JSON in headers');
							setIsSaving(false);
							return;
						}
					}
				}
				
				// For CrewAI type, add model and base URL settings
				if (settings.type === 'crew_ai') {
					// Add the Ollama base URL to settings
					if (formData['agent-ollama-url']) {
						settings = {
							...settings,
							base_url: formData['agent-ollama-url']
						};
					}
					
					// Add the model name to settings
					if (formData['agent-model']) {
						settings = {
							...settings,
							model: formData['agent-model']
						};
					}
					
					// Add role, goal, and backstory if provided
					if (formData['agent-role']) {
						settings = {
							...settings,
							role: formData['agent-role']
						};
					}
					
					if (formData['agent-goal']) {
						settings = {
							...settings,
							goal: formData['agent-goal']
						};
					}
					
					if (formData['agent-backstory']) {
						settings = {
							...settings,
							backstory: formData['agent-backstory']
						};
					}
					
					// Add temperature if provided
					if (formData['agent-temperature']) {
						settings = {
							...settings,
							temperature: parseFloat(formData['agent-temperature'])
						};
					}
					
					// Add max_tokens if provided
					if (formData['agent-max-tokens']) {
						settings = {
							...settings,
							max_tokens: parseInt(formData['agent-max-tokens'], 10)
						};
					}
				} else if (settings.type === 'external_api') {
					// For External API type, add API endpoint settings
					if (formData['agent-api-endpoint']) {
						settings = {
							...settings,
							api_endpoint: formData['agent-api-endpoint']
						};
					}
					
					// Add API key if provided
					if (formData['agent-api-key']) {
						settings = {
							...settings,
							api_key: formData['agent-api-key']
						};
					}
					
					// Add request template if provided
					if (formData['agent-request-template']) {
						settings = {
							...settings,
							request_template: formData['agent-request-template']
						};
					}
					
					// Add response mapping if provided
					if (formData['agent-response-mapping']) {
						settings = {
							...settings,
							response_mapping: formData['agent-response-mapping']
						};
					}
					
					// Add headers if provided
					if (formData['agent-headers']) {
						try {
							settings = {
								...settings,
								headers: JSON.parse(formData['agent-headers'])
							};
						} catch (error) {
							console.error('Error parsing headers:', error);
							// If invalid JSON, don't add headers
						}
					}
				}
				
				const agentData = {
					name: formData['agent-name'],
					version: formData['agent-version'],
					prompt: formData['agent-prompt'],
					settings: JSON.stringify(settings),
				};

				if (editingId) {
					// Update existing agent
					await api.updateAgent(editingId, agentData);
				} else {
					// Create new agent
					await api.createAgent(agentData);
				}
			} else if (modalType === 'test') {
				const testData = {
					name: formData['test-name'],
					description: formData['test-description'],
					input: formData['test-input'],
					expected_output: formData['test-expected-output'],
				};

				if (editingId) {
					// Update existing test
					await api.updateTest(editingId, testData);
				} else {
					// Create new test
					await api.createTest(testData);
				}
			}
			await fetchData();
			setIsModalOpen(false);
			setFormData({});
			setEditingId(null);
		} catch (error) {
			console.error('Error saving:', error);
			setError(error instanceof Error ? error.message : 'An unknown error occurred');
			// Keep the modal open so the user can see the error and try again
		} finally {
			setIsSaving(false);
		}
	};

	// Add a test connection function
	const testApiConnection = async () => {
		// Reset status
		setTestConnectionStatus({ loading: true });
		
		try {
			// Validate required fields
			if (!formData['agent-api-endpoint']) {
				setTestConnectionStatus({
					loading: false,
					success: false,
					message: 'API Endpoint is required'
				});
				return;
			}
			
			// Validate URL format
			try {
				new URL(formData['agent-api-endpoint']);
			} catch (error) {
				console.error('Invalid URL format:', error);
				setTestConnectionStatus({
					loading: false,
					success: false,
					message: 'Invalid API Endpoint URL format'
				});
				return;
			}
			
			// Prepare headers
			let headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			
			// Add API key if provided
			if (formData['agent-api-key']) {
				headers['Authorization'] = `Bearer ${formData['agent-api-key']}`;
			}
			
			// Add custom headers if provided
			if (formData['agent-headers']) {
				try {
					const customHeaders = JSON.parse(formData['agent-headers']);
					headers = { ...headers, ...customHeaders };
				} catch (error) {
					console.error('Invalid headers JSON:', error);
					// Invalid JSON, ignore
				}
			}
			
			// Prepare request body
			let body = { test: 'connection' };
			
			// Use request template if provided
			if (formData['agent-request-template']) {
				try {
					const template = formData['agent-request-template'].replace(/\{\{input\}\}/g, 'test connection');
					body = JSON.parse(template);
				} catch (error) {
					console.error('Invalid request template:', error);
					// Invalid JSON, use default
				}
			}
			
			// Make the request
			const response = await fetch(formData['agent-api-endpoint'], {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
			});
			
			if (response.ok) {
				setTestConnectionStatus({
					loading: false,
					success: true,
					message: `Connection successful! Status: ${response.status}`
				});
			} else {
				setTestConnectionStatus({
					loading: false,
					success: false,
					message: `Connection failed. Status: ${response.status} ${response.statusText}`
				});
			}
		} catch (error) {
			console.error('Connection error:', error);
			setTestConnectionStatus({
				loading: false,
				success: false,
				message: `Connection error: ${(error as Error).message}`
			});
		}
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
		execution_time: result.execution_time ? result.execution_time.toFixed(3) : '0.000',
		created_at: new Date(result.created_at!).toLocaleString(),
	}));

	const agentHeaders = [
		{ key: 'name', header: 'Name' },
		{ key: 'version', header: 'Version' },
		{ key: 'created_at', header: 'Created At' },
		{ key: 'actions', header: 'Actions' },
	];

	const testHeaders = [
		{ key: 'name', header: 'Name' },
		{ key: 'description', header: 'Description' },
		{ key: 'created_at', header: 'Created At' },
		{ key: 'actions', header: 'Actions' },
	];

	const resultHeaders = [
		{ key: 'agent_name', header: 'Agent' },
		{ key: 'test_name', header: 'Test' },
		{ key: 'success', header: 'Success' },
		{ key: 'execution_time', header: 'Time (s)' },
		{ key: 'created_at', header: 'Created At' },
		{ key: 'actions', header: 'Actions' },
	];

	const handleAddClick = (type: 'agent' | 'test') => {
		setModalType(type);
		setFormData({});
		setEditingId(null);
		setIsModalOpen(true);
	};

	const handleEditAgent = (agentId: number) => {
		const agent = agents.find(a => a.id === agentId);
		if (!agent) return;

		setModalType('agent');
		setEditingId(agentId);

		// Parse settings to extract individual fields
		let settings: AgentSettings = {};
		try {
			settings = JSON.parse(agent.settings);
		} catch (e) {
			console.error('Error parsing agent settings:', e);
		}

		const formEntries: Record<string, string> = {
			'agent-name': agent.name || '',
			'agent-version': agent.version || '',
			'agent-prompt': agent.prompt || '',
			'agent-settings': agent.settings || '',
			'agent-type': settings.type || 'crew_ai',
		};

		// Add CrewAI specific settings
		if (settings.type !== 'external_api') {
			formEntries['agent-role'] = settings.role || '';
			formEntries['agent-goal'] = settings.goal || '';
			formEntries['agent-backstory'] = settings.backstory || '';
			formEntries['agent-model'] = settings.model || '';
			formEntries['agent-temperature'] = settings.temperature?.toString() || '';
			formEntries['agent-max-tokens'] = settings.max_tokens?.toString() || '';
			formEntries['agent-ollama-url'] = settings.base_url || '';
		} else {
			// External API settings
			formEntries['agent-api-endpoint'] = settings.api_endpoint || '';
			formEntries['agent-api-key'] = settings.api_key || '';
			formEntries['agent-request-template'] = settings.request_template || '';
			formEntries['agent-response-mapping'] = settings.response_mapping || '';
			formEntries['agent-headers'] = settings.headers ? JSON.stringify(settings.headers, null, 2) : '';
		}

		setFormData(formEntries);
		setIsModalOpen(true);
	};

	const handleEditTest = (testId: number) => {
		const test = tests.find(t => t.id === testId);
		if (!test) return;

		setModalType('test');
		setEditingId(testId);

		setFormData({
			'test-name': test.name || '',
			'test-description': test.description || '',
			'test-input': test.input || '',
			'test-expected-output': test.expected_output || '',
		});

		setIsModalOpen(true);
	};

	const handleViewResult = (resultId: number) => {
		const result = results.find(r => r.id === resultId);
		if (result && result.id !== undefined) {
			setEditingId(result.id);
			setModalType('result');
			setIsModalOpen(true);
		}
	};

	const handleDeleteAgent = async (agentId: number) => {
		const agent = agents.find(a => a.id === agentId);
		if (!agent) return;
		
		setDeleteType('agent');
		setDeleteId(agentId);
		setDeleteName(agent.name);
		setIsDeleteModalOpen(true);
	};

	const handleDeleteTest = async (testId: number) => {
		const test = tests.find(t => t.id === testId);
		if (!test) return;
		
		setDeleteType('test');
		setDeleteId(testId);
		setDeleteName(test.name);
		setIsDeleteModalOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!deleteId || !deleteType) return;
		
		setIsDeleting(true);
		try {
			if (deleteType === 'agent') {
				await api.deleteAgent(deleteId);
			} else if (deleteType === 'test') {
				await api.deleteTest(deleteId);
			}
			
			await fetchData();
			setIsDeleteModalOpen(false);
			setDeleteType(null);
			setDeleteId(null);
			setDeleteName('');
		} catch (error) {
			console.error(`Error deleting ${deleteType}:`, error);
			setError(error instanceof Error ? error.message : `Failed to delete ${deleteType}`);
		} finally {
			setIsDeleting(false);
		}
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
		rows: Array<{ id: string;[key: string]: string | number | boolean }>,
		type: 'agent' | 'test' | 'result'
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
									if (cell.info.header === 'actions' && type === 'agent') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<div style={{ display: 'flex', gap: '0.5rem' }}>
													<Button
														kind="ghost"
														size="sm"
														renderIcon={Edit}
														iconDescription="Edit agent"
														hasIconOnly
														onClick={() => {
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId)) {
																handleEditAgent(numericId);
															}
														}}
													/>
													<Button
														kind="danger--ghost"
														size="sm"
														renderIcon={TrashCan}
														iconDescription="Delete agent"
														hasIconOnly
														onClick={() => {
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId)) {
																handleDeleteAgent(numericId);
															}
														}}
													/>
												</div>
											</TableCell>
										);
									}
									if (cell.info.header === 'actions' && type === 'test') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<div style={{ display: 'flex', gap: '0.5rem' }}>
													<Button
														kind="ghost"
														size="sm"
														renderIcon={Edit}
														iconDescription="Edit test"
														hasIconOnly
														onClick={() => {
															// Extract the numeric ID from the row ID
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId)) {
																handleEditTest(numericId);
															}
														}}
													/>
													<Button
														kind="danger--ghost"
														size="sm"
														renderIcon={TrashCan}
														iconDescription="Delete test"
														hasIconOnly
														onClick={() => {
															// Extract the numeric ID from the row ID
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId)) {
																handleDeleteTest(numericId);
															}
														}}
													/>
												</div>
											</TableCell>
										);
									}
									if (cell.info.header === 'actions' && type === 'result') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<Button
													kind="ghost"
													size="sm"
													renderIcon={DataTableIcon}
													iconDescription="View details"
													hasIconOnly
													onClick={() => {
														// Extract the numeric ID from the row ID
														const rowId = row.id;
														const numericId = parseInt(rowId);
														if (!isNaN(numericId)) {
															handleViewResult(numericId);
														}
													}}
												/>
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
		<main className={styles.main}>
			<div className={styles.description}>
				<h1>AI Agent Testing Suite</h1>
			</div>

			<Tabs>
				<TabList aria-label="AI Agent Testing Suite Tabs">
					<Tab>Tests</Tab>
					<Tab>Agents</Tab>
					<Tab>Results</Tab>
					<Tab>Jobs</Tab>
					<Tab>Run Test</Tab>
				</TabList>

				<TabPanels>
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
							renderTable(testHeaders, testRows, 'test')
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
							renderTable(agentHeaders, agentRows, 'agent')
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
							<h2>Results</h2>
						</div>
						{isLoading ? (
							<InlineLoading description="Loading data..." />
						) : resultRows.length > 0 ? (
							renderTable(resultHeaders, resultRows, 'result')
						) : (
							<EmptyState
								title="Test Results"
								description="Run tests against your agents to see results here."
								icon={Report as React.ComponentType<{ size: number; className?: string }>}
								onAddClick={() => handleAddClick('test')}
							/>
						)}
					</TabPanel>

					{/* Jobs Tab */}
					<TabPanel>
						<JobsManager 
							agents={agents} 
							tests={tests} 
							onRefresh={fetchData} 
							onResultView={handleViewResult} 
						/>
					</TabPanel>

					{/* Run Test Tab */}
					<TabPanel>
						<TestExecutor 
							agents={agents} 
							tests={tests} 
							onJobCreated={fetchData} 
						/>
					</TabPanel>
				</TabPanels>
			</Tabs>

			{/* Add/Edit Modal */}
			<Modal
				open={isModalOpen}
				modalHeading={`${editingId ? 'Edit' : 'Add New'} ${modalType === 'agent' ? 'Agent' : 'Test'}`}
				primaryButtonText={isSaving ? 'Saving...' : 'Save'}
				secondaryButtonText="Cancel"
				onRequestClose={() => {
					setIsModalOpen(false);
					setError(null);
					setEditingId(null);
				}}
				onRequestSubmit={handleSubmit}
				primaryButtonDisabled={isSaving}
			>
				{error && (
					<div style={{ 
						marginBottom: '1rem', 
						padding: '0.5rem', 
						backgroundColor: '#fff1f1', 
						color: '#da1e28',
						borderLeft: '3px solid #da1e28'
					}}>
						{error}
					</div>
				)}
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
								
								{/* Agent Type Selection */}
								<RadioButtonGroup
									legendText="Agent Type"
									name="agent-type"
									orientation="horizontal"
									valueSelected={formData['agent-type'] || 'crew_ai'}
									onChange={(value) => {
										handleInputChange({
											target: { id: 'agent-type', value }
										} as React.ChangeEvent<HTMLInputElement>);
									}}
								>
									<RadioButton
										id="crew_ai"
										labelText="CrewAI Agent"
										value="crew_ai"
									/>
									<RadioButton
										id="external_api"
										labelText="External API Agent"
										value="external_api"
									/>
								</RadioButtonGroup>
								
								{/* Show different fields based on agent type */}
								{(formData['agent-type'] !== 'external_api') ? (
									<>
										{/* CrewAI Agent Configuration */}
										<TextInput
											id="agent-role"
											labelText="Role"
											placeholder="Enter agent role (e.g., AI Assistant)"
											value={formData['agent-role'] || ''}
											onChange={handleInputChange}
										/>
										<TextInput
											id="agent-goal"
											labelText="Goal"
											placeholder="Enter agent goal (e.g., Help the user with their tasks)"
											value={formData['agent-goal'] || ''}
											onChange={handleInputChange}
										/>
										<TextArea
											id="agent-backstory"
											labelText="Backstory"
											placeholder="Enter agent backstory"
											rows={2}
											value={formData['agent-backstory'] || ''}
											onChange={handleInputChange}
										/>
										<TextInput
											id="agent-model"
											labelText="Model Name"
											placeholder="Enter model name (e.g., llama3, mistral, etc.)"
											value={formData['agent-model'] || ''}
											onChange={handleInputChange}
										/>
										<div style={{ display: 'flex', gap: '1rem' }}>
											<TextInput
												id="agent-temperature"
												labelText="Temperature"
												placeholder="0.7"
												value={formData['agent-temperature'] || ''}
												onChange={handleInputChange}
												style={{ flex: 1 }}
											/>
											<TextInput
												id="agent-max-tokens"
												labelText="Max Tokens"
												placeholder="1000"
												value={formData['agent-max-tokens'] || ''}
												onChange={handleInputChange}
												style={{ flex: 1 }}
											/>
										</div>
										<TextInput
											id="agent-ollama-url"
											labelText="Ollama Base URL"
											placeholder="Enter Ollama base URL (e.g., http://your-ollama-host:11434)"
											value={formData['agent-ollama-url'] || ''}
											onChange={handleInputChange}
										/>
									</>
								) : (
									<>
										{/* External API Agent Configuration */}
										<TextInput
											id="agent-api-endpoint"
											labelText="API Endpoint"
											placeholder="Enter API endpoint URL (e.g., https://api.example.com/v1/completion)"
											value={formData['agent-api-endpoint'] || ''}
											onChange={handleInputChange}
											required
										/>
										<TextInput
											id="agent-api-key"
											labelText="API Key (Optional)"
											placeholder="Enter API key for authentication"
											value={formData['agent-api-key'] || ''}
											onChange={handleInputChange}
											type="password"
										/>
										<TextArea
											id="agent-request-template"
											labelText="Request Template (Optional)"
											placeholder='JSON template with {{input}} placeholder, e.g.: {"prompt": "{{input}}", "max_tokens": 1000}'
											rows={4}
											value={formData['agent-request-template'] || ''}
											onChange={handleInputChange}
											helperText="Use {{input}} as a placeholder for the test input"
										/>
										<TextArea
											id="agent-response-mapping"
											labelText="Response Mapping (Optional)"
											placeholder='JSON mapping to extract response, e.g.: {"output": "choices.0.text", "success_criteria": {"type": "contains", "value": "completed"}}'
											rows={4}
											value={formData['agent-response-mapping'] || ''}
											onChange={handleInputChange}
											helperText="Specify how to extract output and determine success"
										/>
										<TextArea
											id="agent-headers"
											labelText="Headers (Optional)"
											placeholder='Enter custom headers as JSON, e.g.: {"Content-Type": "application/json", "X-Custom-Header": "value"}'
											rows={3}
											value={formData['agent-headers'] || ''}
											onChange={handleInputChange}
											helperText="Custom HTTP headers as JSON object"
										/>

										{/* Test Connection Button */}
										<div>
											<Button
												kind="tertiary"
												onClick={testApiConnection}
												disabled={!formData['agent-api-endpoint'] || testConnectionStatus?.loading}
												renderIcon={Launch}
												size="sm"
											>
												{testConnectionStatus?.loading ? 'Testing...' : 'Test Connection'}
											</Button>
											
											{testConnectionStatus && !testConnectionStatus.loading && (
												<InlineNotification
													kind={testConnectionStatus.success ? 'success' : 'error'}
													title={testConnectionStatus.success ? 'Success' : 'Error'}
													subtitle={testConnectionStatus.message}
													hideCloseButton
													lowContrast
													style={{ marginTop: '0.5rem' }}
												/>
											)}
										</div>
									</>
								)}
								
								<TextArea
									id="agent-prompt"
									labelText="Prompt"
									placeholder="Enter agent prompt"
									rows={4}
									value={formData['agent-prompt'] || ''}
									onChange={handleInputChange}
								/>
								
								{formData['agent-type'] !== 'external_api' && (
									<TextArea
										id="agent-settings"
										labelText="Advanced Settings (JSON)"
										placeholder="Enter agent settings as JSON"
										rows={4}
										value={formData['agent-settings'] || ''}
										onChange={handleInputChange}
									/>
								)}
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

			{/* Result Modal */}
			<Modal
				open={isModalOpen && modalType === 'result'}
				modalHeading="Test Result Details"
				primaryButtonText="Close"
				onRequestClose={() => {
					setIsModalOpen(false);
					setModalType(null);
					setEditingId(null);
					setError(null);
				}}
				onRequestSubmit={() => {
					setIsModalOpen(false);
					setModalType(null);
					setEditingId(null);
					setError(null);
				}}
			>
				{editingId && (
					<Stack gap={5}>
						{error && (
							<div style={{ 
								marginBottom: '1rem', 
								padding: '0.5rem', 
								backgroundColor: '#fff1f1', 
								color: '#da1e28',
								borderLeft: '3px solid #da1e28'
							}}>
								{error}
							</div>
						)}
						{(() => {
							const result = results.find(r => r.id === editingId);
							if (!result) return <p>Result not found</p>;
							
							return (
								<>
									<div>
										<h4 style={{ color: '#f4f4f4', marginBottom: '0.5rem' }}>Output</h4>
										<CodeSnippet type="multi" feedback="Copied to clipboard" wrapText>
											{result.output}
										</CodeSnippet>
									</div>
									{result.intermediate_steps && (
										<div>
											<h4 style={{ color: '#f4f4f4', marginBottom: '0.5rem', marginTop: '1rem' }}>
												Intermediate Steps
											</h4>
											<CodeSnippet type="multi" feedback="Copied to clipboard" wrapText maxCollapsedNumberOfRows={20}>
												{result.intermediate_steps}
											</CodeSnippet>
										</div>
									)}
									<div style={{ 
										display: 'flex', 
										gap: '1rem', 
										alignItems: 'center',
										marginTop: '1rem',
										padding: '1rem',
										backgroundColor: '#161616',
										borderRadius: '4px'
									}}>
										<div>
											<strong style={{ color: '#f4f4f4' }}>Success:</strong>{' '}
											<Tag type={result.success ? 'green' : 'red'}>
												{result.success ? 'Success' : 'Failed'}
											</Tag>
										</div>
										{result.execution_time && (
											<div>
												<strong style={{ color: '#f4f4f4' }}>Execution Time:</strong>{' '}
												<span style={{ color: '#f4f4f4' }}>
													{result.execution_time.toFixed(3)}s
												</span>
											</div>
										)}
									</div>
								</>
							);
						})()}
					</Stack>
				)}
			</Modal>

			{/* Delete Modal */}
			<Modal
				open={isDeleteModalOpen}
				modalHeading={`Delete ${deleteType === 'agent' ? 'Agent' : 'Test'}`}
				primaryButtonText={isDeleting ? 'Deleting...' : 'Delete'}
				secondaryButtonText="Cancel"
				onRequestClose={() => {
					setIsDeleteModalOpen(false);
					setDeleteType(null);
					setDeleteId(null);
					setDeleteName('');
					setError(null);
				}}
				onRequestSubmit={handleConfirmDelete}
				primaryButtonDisabled={isDeleting}
			>
				{error && (
					<div style={{ 
						marginBottom: '1rem', 
						padding: '0.5rem', 
						backgroundColor: '#fff1f1', 
						color: '#da1e28',
						borderLeft: '3px solid #da1e28'
					}}>
						{error}
					</div>
				)}
				<p>Are you sure you want to delete the {deleteType === 'agent' ? 'agent' : 'test'} &quot;{deleteName}&quot;?</p>
			</Modal>
		</main>
	);
}
