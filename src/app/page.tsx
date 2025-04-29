'use client';

import { Grid, Column } from '@carbon/react';
import { Tag, ProgressIndicator, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
import { useAppData } from '../lib/AppDataContext';
import { api, SuiteRun, Job } from '../lib/api';
import { useEffect, useState } from 'react';
import styles from './page.module.scss';
import TileWrapper from './components/TileWrapper';

interface ResultWithStatus {
	status?: string;
	created_at?: string;
	agent_id?: number;
	test_id?: number;
	execution_time?: number;
	success?: boolean;
	intermediate_steps?: string;
}

interface AgentPerformanceMetrics {
	agentId: number;
	agentName: string;
	totalTests: number;
	successfulTests: number;
	successRate: string;
	avgExecutionTime: string;
	tokenUsage?: number;
	modelCalls?: number;
	toolCalls?: number;
}

export default function Home() {
	const { agents, tests, results } = useAppData();
	const [suiteRuns, setSuiteRuns] = useState<SuiteRun[]>([]);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [agentMetrics, setAgentMetrics] = useState<AgentPerformanceMetrics[]>([]);

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const [suiteRunsData, jobsData] = await Promise.all([
					api.getSuiteRuns(),
					api.getJobs()
				]);
				setSuiteRuns(suiteRunsData);
				setJobs(jobsData);
			} catch (error) {
				console.error('Error fetching dashboard data:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();
	}, []);

	// Calculate agent performance metrics whenever results or agents change
	useEffect(() => {
		calculateAgentMetrics();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [results, agents]);

	const calculateAgentMetrics = () => {
		if (!results.length || !agents.length) return;

		// Group results by agent
		const agentResultMap = new Map<number, ResultWithStatus[]>();
		
		results.forEach(result => {
			const typedResult = result as ResultWithStatus;
			const agentId = typedResult.agent_id;
			if (agentId) {
				if (!agentResultMap.has(agentId)) {
					agentResultMap.set(agentId, []);
				}
				agentResultMap.get(agentId)?.push(typedResult);
			}
		});

		// Calculate metrics for each agent
		const metrics: AgentPerformanceMetrics[] = [];
		
		agentResultMap.forEach((agentResults, agentId) => {
			const agent = agents.find(a => a.id === agentId);
			if (!agent) return;
			
			const totalTests = agentResults.length;
			const successfulTests = agentResults.filter(r => r.success).length;
			const successRate = totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) : '0.0';
			
			// Calculate average execution time
			const executionTimes = agentResults
				.filter(r => r.execution_time !== undefined)
				.map(r => r.execution_time as number);
				
			const avgExecutionTime = executionTimes.length > 0
				? (executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length).toFixed(0)
				: 'N/A';
				
			// Extract token usage metrics if available (from intermediate_steps)
			let tokenUsage: number | undefined;
			let modelCalls: number | undefined;
			let toolCalls: number | undefined;
			
			// Try to extract metrics from intermediate steps if available
			agentResults.forEach(result => {
				if (result.intermediate_steps) {
					try {
						const stepsData = JSON.parse(result.intermediate_steps);
						// This is a simplification - actual format would need to be checked
						if (stepsData.metrics) {
							tokenUsage = (tokenUsage || 0) + (stepsData.metrics.token_usage || 0);
							modelCalls = (modelCalls || 0) + (stepsData.metrics.model_calls || 0);
							toolCalls = (toolCalls || 0) + (stepsData.metrics.tool_calls || 0);
						}
					} catch {
						// Silently fail if we can't parse the JSON
					}
				}
			});
				
			metrics.push({
				agentId,
				agentName: `${agent.name} (v${agent.version})`,
				totalTests,
				successfulTests,
				successRate,
				avgExecutionTime: avgExecutionTime !== 'N/A' ? `${avgExecutionTime}ms` : avgExecutionTime,
				tokenUsage,
				modelCalls,
				toolCalls
			});
		});
		
		// Sort by success rate (descending)
		metrics.sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate));
		
		setAgentMetrics(metrics);
	};

	// Calculate metrics
	const activeJobs = jobs.filter(job => job.status === 'running').length;
	const pendingJobs = jobs.filter(job => job.status === 'pending').length;
	const completedJobs = jobs.filter(job => job.status === 'completed').length;
	const failedJobs = jobs.filter(job => job.status === 'failed').length;
	
	const recentSuiteRuns = suiteRuns.slice(0, 5);
	
	// Success rate calculation
	const testSuccessRate = results.length > 0 
		? (results.filter(r => (r as ResultWithStatus).success).length / results.length * 100).toFixed(1) 
		: '0.0';
		
	// Recent activity calculation
	const lastWeekResults = results.filter(r => {
		const resultDate = new Date((r as ResultWithStatus).created_at || '');
		const oneWeekAgo = new Date();
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
		return resultDate >= oneWeekAgo;
	});

	return (
		<div>
			<h1>Dashboard</h1>
			
			<Grid fullWidth narrow className={styles.content}>
				{/* Summary Metrics */}
				<Column sm={4} md={4} lg={4}>
					<TileWrapper title="Agents">
						<div className={styles.metricValue}>{agents.length}</div>
					</TileWrapper>
				</Column>
				<Column sm={4} md={4} lg={4}>
					<TileWrapper title="Tests">
						<div className={styles.metricValue}>{tests.length}</div>
					</TileWrapper>
				</Column>
				<Column sm={4} md={4} lg={4}>
					<TileWrapper title="Test Results">
						<div className={styles.metricValue}>{results.length}</div>
					</TileWrapper>
				</Column>
				<Column sm={4} md={4} lg={4}>
					<TileWrapper title="Success Rate">
						<div className={styles.metricValue}>{testSuccessRate}%</div>
					</TileWrapper>
				</Column>
				
				{/* Job Status Overview */}
				<Column sm={4} md={8} lg={8}>
					<TileWrapper title="Active Jobs">
						<div>
							<Tag type="green">Running: {activeJobs}</Tag>{' '}
							<Tag type="blue">Pending: {pendingJobs}</Tag>{' '}
							<Tag type="purple">Completed: {completedJobs}</Tag>{' '}
							<Tag type="red">Failed: {failedJobs}</Tag>
						</div>
					</TileWrapper>
				</Column>
				
				{/* Recent Test Runs */}
				<Column sm={4} md={8} lg={8}>
					<TileWrapper title="Recent Suite Runs">
						{loading ? (
							<ProgressIndicator />
						) : recentSuiteRuns.length > 0 ? (
							<div>
								{recentSuiteRuns.map(run => (
									<div key={run.id} style={{ marginBottom: '10px' }}>
										<Tag type={run.status === 'completed' ? 'green' : 
												run.status === 'running' ? 'blue' : 
												run.status === 'failed' ? 'red' : 'gray'}>
											{run.status}
										</Tag>
										<span style={{ marginLeft: '10px' }}>
											Suite #{run.suite_id} with Agent #{run.agent_id} - 
											{run.successful_tests}/{run.total_tests} tests passed
										</span>
									</div>
								))}
							</div>
						) : (
							<p>No recent suite runs</p>
						)}
					</TileWrapper>
				</Column>
				
				{/* Recent Activity */}
				<Column sm={4} md={8} lg={8}>
					<TileWrapper title="Recent Activity">
						<p>Tests run in the last 7 days: {lastWeekResults.length}</p>
					</TileWrapper>
				</Column>
				
				{/* Agent Performance */}
				<Column sm={4} md={8} lg={16}>
					<TileWrapper title="Agent Performance">
						{loading ? (
							<ProgressIndicator />
						) : agentMetrics.length > 0 ? (
							<Table>
								<TableHead>
									<TableRow>
										<TableHeader>Agent</TableHeader>
										<TableHeader>Success Rate</TableHeader>
										<TableHeader>Tests</TableHeader>
										<TableHeader>Avg. Time</TableHeader>
										{agentMetrics.some(m => m.tokenUsage !== undefined) && (
											<TableHeader>Token Usage</TableHeader>
										)}
										{agentMetrics.some(m => m.modelCalls !== undefined) && (
											<TableHeader>Model Calls</TableHeader>
										)}
										{agentMetrics.some(m => m.toolCalls !== undefined) && (
											<TableHeader>Tool Calls</TableHeader>
										)}
									</TableRow>
								</TableHead>
								<TableBody>
									{agentMetrics.map(metric => (
										<TableRow key={metric.agentId}>
											<TableCell>{metric.agentName}</TableCell>
											<TableCell>
												<Tag type={parseFloat(metric.successRate) > 75 ? 'green' : 
													parseFloat(metric.successRate) > 50 ? 'blue' : 
													parseFloat(metric.successRate) > 25 ? 'purple' : 'red'}>
													{metric.successRate}%
												</Tag>
											</TableCell>
											<TableCell>{metric.successfulTests}/{metric.totalTests}</TableCell>
											<TableCell>{metric.avgExecutionTime}</TableCell>
											{agentMetrics.some(m => m.tokenUsage !== undefined) && (
												<TableCell>{metric.tokenUsage || 'N/A'}</TableCell>
											)}
											{agentMetrics.some(m => m.modelCalls !== undefined) && (
												<TableCell>{metric.modelCalls || 'N/A'}</TableCell>
											)}
											{agentMetrics.some(m => m.toolCalls !== undefined) && (
												<TableCell>{metric.toolCalls || 'N/A'}</TableCell>
											)}
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : results.length > 0 ? (
							<p>Calculating agent metrics...</p>
						) : (
							<p>No test results available to display agent performance</p>
						)}
					</TileWrapper>
				</Column>
			</Grid>
		</div>
	);
}
