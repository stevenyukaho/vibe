import axios from 'axios';
import { apiService } from './api-service';
import {
	TestExecutionRequest,
	ConversationExecutionRequest,
	ConversationMessage,
	ConversationExecutionResponse,
	Job,
	Agent,
	Test,
	Conversation,
	AgentSettings,
	JobStatus
} from '../types';
import { BACKEND_CONFIG } from '../config';

interface RequestTemplate {
	id: number;
	body: string;
	is_default?: number;
}

interface ResponseMap {
	id: number;
	spec: string;
	is_default?: number;
}

interface AgentConfig {
	templates: RequestTemplate[];
	maps: ResponseMap[];
	defaultTemplate?: RequestTemplate;
	defaultMap?: ResponseMap;
}

/**
 * Job Poller Service - Polls backend for jobs and executes them using ApiService
 */
export class JobPollerService {
	private backendUrl: string;
	private serviceId: string;
	private isPolling: boolean = false;
	private pollingInterval: NodeJS.Timeout | null = null;
	private isCurrentlyPolling: boolean = false;

	constructor(backendUrl: string = BACKEND_CONFIG.url, serviceId: string = 'agent-service-api') {
		this.backendUrl = backendUrl;
		this.serviceId = serviceId;
	}

	/**
	 * Start polling for jobs
	 */
	startPolling(intervalMs: number = 5000): void {
		if (this.isPolling) {
			return;
		}

		this.isPolling = true;

		this.pollingInterval = setInterval(async () => {
			if (this.isCurrentlyPolling) {
				return;
			}
			await this.pollAndExecuteJobs();
		}, intervalMs);

		this.pollAndExecuteJobs();
	}

	/**
	 * Stop polling for jobs
	 */
	stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
		this.isPolling = false;
	}

	/**
	 * Poll for available jobs and execute them
	 */
	private async pollAndExecuteJobs(): Promise<void> {
		if (this.isCurrentlyPolling) {
			return;
		}

		this.isCurrentlyPolling = true;

		try {
			// Get available jobs for external API type
			const response = await axios.get(`${this.backendUrl}/api/jobs/available/external_api?limit=5`);
			const jobs: Job[] = response.data;

			if (jobs.length === 0) {
				return; // No jobs available
			}

			// Process each job
			for (const job of jobs) {
				await this.executeJob(job);
			}
		} catch (error: any) {
			console.error('Error polling for jobs:', error);
		} finally {
			this.isCurrentlyPolling = false;
		}
	}

	/**
	 * Execute a single job
	 */
	private async executeJob(job: Job): Promise<void> {
		try {
			// Claim the job
			const claimResponse = await axios.post(`${this.backendUrl}/api/jobs/${job.id}/claim`, {
				service_id: this.serviceId
			});

			if (claimResponse.status !== 200) {
				return;
			}

			// Get agent details
			const agentResponse = await axios.get(`${this.backendUrl}/api/agents/${job.agent_id}`);
			const agent: Agent = agentResponse.data;
			const settings: AgentSettings = JSON.parse(agent.settings);
			const agentType = settings.type;

			if (agentType !== 'external_api') {
				const errorMsg = `Job ${job.id} is not for external API agent (type: ${agentType})`;
				console.warn(errorMsg);
				await this.updateJobStatus(job.id, 'failed', 0, undefined, errorMsg);
				return;
			}

			await this.updateJobStatus(job.id, 'running', 10);

			// Determine if this is a conversation or legacy test job
			if (job.conversation_id) {
				await this.executeConversationJob(job, agent, settings);
			} else if (job.test_id) {
				await this.executeLegacyTestJob(job, agent, settings);
			} else {
				const errorMsg = `Job ${job.id} has neither conversation_id nor test_id`;
				console.error(errorMsg);
				await this.updateJobStatus(job.id, 'failed', 0, undefined, errorMsg);
			}
		} catch (error: any) {
			console.error(`Error executing job ${job.id}:`, error.message);
			await this.updateJobStatus(job.id, 'failed', 0, undefined, error.message);
		}
	}

	private async getAgentConfig(agentId: number): Promise<AgentConfig> {
		const [templatesRes, mapsRes] = await Promise.all([
			axios.get(`${this.backendUrl}/api/agents/${agentId}/request-templates`),
			axios.get(`${this.backendUrl}/api/agents/${agentId}/response-maps`)
		]);
		const templates: RequestTemplate[] = templatesRes.data || [];
		const maps: ResponseMap[] = mapsRes.data || [];

		return {
			templates,
			maps,
			defaultTemplate: templates.find(t => Number(t.is_default) === 1),
			defaultMap: maps.find(m => Number(m.is_default) === 1)
		};
	}

	/**
	 * Execute a conversation job
	 */
	private async executeConversationJob(job: Job, agent: Agent, settings: AgentSettings): Promise<void> {
		try {
			const startTime = new Date().toISOString();

			// Get conversation and messages
			const conversationResponse = await axios.get(`${this.backendUrl}/api/conversations/${job.conversation_id}`);
			const conversation: Conversation = conversationResponse.data;

			// Fetch agent communication configs
			const agentConfig = await this.getAgentConfig(job.agent_id);

			// Build resolved script
			const resolvedScript = this.resolveConversationScript(conversation, agentConfig);

			const executionRequest: ConversationExecutionRequest = {
				conversation_id: conversation.id!,
				conversation_script: resolvedScript,
				api_endpoint: settings.api_endpoint,
				http_method: settings.http_method,
				headers: settings.headers,
				api_key: settings.api_key,
				token_mapping: settings.token_mapping,
				stop_on_failure: Boolean(conversation.stop_on_failure)
			};

			await this.updateJobStatus(job.id, 'running', 30);

			const result = await apiService.executeConversation(executionRequest);

			await this.updateJobStatus(job.id, 'running', 80);

			const completionTime = new Date().toISOString();

			// Create execution session and save messages
			const sessionId = await this.saveSessionResults(
				conversation.id!,
				agent.id!,
				startTime,
				completionTime,
				result
			);

			await this.updateJobStatus(job.id, 'completed', 100, undefined, undefined, sessionId);
		} catch (error: any) {
			console.error(`Error executing conversation job ${job.id}:`, error.message);
			await this.updateJobStatus(job.id, 'failed', 0, undefined, error.message);
		}
	}

	private resolveConversationScript(conversation: Conversation, agentConfig: AgentConfig): ConversationMessage[] {
		const { templates, maps, defaultTemplate, defaultMap } = agentConfig;
		const conversationDefaultTemplateId = conversation.default_request_template_id;
		const conversationDefaultMapId = conversation.default_response_map_id;

		// Conversation-level variables
		let conversationVars: Record<string, any> = {};
		try {
			if (conversation.variables && conversation.variables.trim().length > 0) {
				conversationVars = JSON.parse(conversation.variables);
			}
		} catch { }

		return (conversation.messages || []).map((m) => {
			if (m.role !== 'user') {
				return m;
			}

			const msgOverrideTemplateId = (m as any).request_template_id as number | undefined;
			const msgOverrideMapId = (m as any).response_map_id as number | undefined;

			// Message-level set_variables
			let messageVars: Record<string, any> = {};
			try {
				const raw = (m as any).set_variables;
				if (raw && typeof raw === 'string' && raw.trim().length > 0) {
					messageVars = JSON.parse(raw);
				}
			} catch { }

			const effectiveTemplate =
				(templates.find(t => t.id === msgOverrideTemplateId)?.body) ??
				(templates.find(t => t.id === conversationDefaultTemplateId)?.body) ??
				(defaultTemplate?.body);

			const effectiveMap =
				(maps.find(r => r.id === msgOverrideMapId)?.spec) ??
				(maps.find(r => r.id === conversationDefaultMapId)?.spec) ??
				(defaultMap?.spec);

			// Merge variables: conversation-level first, then per-message override
			const mergedVars = { ...conversationVars, ...messageVars };

			// Parse metadata if it's a string
			let metadata = m.metadata || {};
			if (typeof metadata === 'string') {
				try {
					metadata = JSON.parse(metadata);
				} catch {
					metadata = {};
				}
			}

			const mergedMetadata = {
				...metadata,
				...(effectiveTemplate ? { request_template: effectiveTemplate } : {}),
				...(effectiveMap ? { response_mapping: effectiveMap } : {}),
				...(Object.keys(mergedVars).length ? { variables: mergedVars } : {})
			};

			return {
				...m,
				metadata: mergedMetadata as any
			};
		});
	}

	private async saveSessionResults(
		conversationId: number,
		agentId: number,
		startTime: string,
		completionTime: string,
		result: ConversationExecutionResponse
	): Promise<number> {
		// Create execution session
		const sessionResponse = await axios.post(`${this.backendUrl}/api/sessions`, {
			conversation_id: conversationId,
			agent_id: agentId,
			status: 'completed',
			started_at: startTime,
			completed_at: completionTime,
			success: result.success,
			variables: JSON.stringify(result.variables || {}),
			metadata: JSON.stringify({
				input_tokens: result.metrics.input_tokens,
				output_tokens: result.metrics.output_tokens,
				token_mapping_metadata: JSON.stringify({
					extraction_method: result.metrics.input_tokens || result.metrics.output_tokens ? 'external_api' : 'none',
					agent_type: 'external_api'
				}),
				intermediate_steps: JSON.stringify(result.intermediate_steps)
			})
		});

		const savedSession = sessionResponse.data;

		// Save transcript messages
		for (const message of result.transcript) {
			await axios.post(`${this.backendUrl}/api/session-messages`, {
				session_id: savedSession.id,
				sequence: message.sequence,
				role: message.role,
				content: message.content,
				timestamp: message.timestamp,
				metadata: JSON.stringify(message.metadata || {})
			});
		}

		return savedSession.id;
	}

	/**
	 * Execute a legacy test job
	 */
	private async executeLegacyTestJob(job: Job, agent: Agent, settings: AgentSettings): Promise<void> {
		try {
			// Get test details
			const testResponse = await axios.get(`${this.backendUrl}/api/tests/${job.test_id}`);
			const test: Test = testResponse.data;

			let requestTemplate = settings.request_template;
			let responseMapping = settings.response_mapping;

			if (!requestTemplate || !responseMapping) {
				try {
					const agentConfig = await this.getAgentConfig(job.agent_id);

					if (!requestTemplate) {
						requestTemplate = agentConfig.defaultTemplate?.body;
					}

					if (!responseMapping) {
						responseMapping = agentConfig.defaultMap?.spec;
					}
				} catch (err) {
					console.warn(`Failed to fetch default template/map for legacy test ${job.test_id}:`, err);
				}
			}

			const executionRequest: TestExecutionRequest = {
				test_id: test.id!,
				test_input: test.input,
				api_endpoint: settings.api_endpoint,
				http_method: settings.http_method,
				headers: settings.headers,
				api_key: settings.api_key,
				request_template: requestTemplate,
				response_mapping: responseMapping,
				token_mapping: settings.token_mapping
			};

			await this.updateJobStatus(job.id, 'running', 30);

			const result = await apiService.executeTest(executionRequest);

			await this.updateJobStatus(job.id, 'running', 80);

			// Send result back to backend (legacy results endpoint)
			const resultResponse = await axios.post(`${this.backendUrl}/api/results`, {
				test_id: test.id!,
				agent_id: agent.id!,
				output: result.output,
				success: result.success,
				execution_time: result.execution_time,
				intermediate_steps: result.intermediate_steps,
				input_tokens: result.metrics.input_tokens,
				output_tokens: result.metrics.output_tokens,
				token_mapping_metadata: JSON.stringify({
					extraction_method: result.metrics.input_tokens || result.metrics.output_tokens ? 'external_api' : 'none',
					agent_type: 'external_api'
				}),
				metrics: result.metrics
			});

			const savedResult = resultResponse.data;

			await this.updateJobStatus(job.id, 'completed', 100, savedResult.id);
		} catch (error: any) {
			console.error(`Error executing legacy test job ${job.id}:`, error.message);
			await this.updateJobStatus(job.id, 'failed', 0, undefined, error.message);
		}
	}

	/**
	 * Update job status in the backend
	 */
	private async updateJobStatus(
		jobId: string,
		status: JobStatus,
		progress: number,
		resultId?: number,
		error?: string,
		sessionId?: number
	): Promise<void> {
		try {
			const updateData: any = {
				status,
				progress
			};

			if (resultId) {
				updateData.result_id = resultId;
			}

			if (sessionId) {
				updateData.session_id = sessionId;
			}

			if (error) {
				updateData.error = error;
			}

			await axios.put(`${this.backendUrl}/api/jobs/${jobId}`, updateData);
		} catch (error: any) {
			console.error(`Error updating job ${jobId} status:`, error.message);
		}
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const response = await axios.get(`${this.backendUrl}/api/health`);
			return response.status === 200;
		} catch (error) {
			return false;
		}
	}
}

// Export singleton instance
export const jobPoller = new JobPollerService();
