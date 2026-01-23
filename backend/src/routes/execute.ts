import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	getAgentById,
	getConversationById,
	getConversationMessages
} from '../db/queries';
import * as templateRepo from '../db/repositories/templateRepo';
import { testIdToConversationId } from '../lib/legacyIdResolver';
import { jobQueue } from '../services/job-queue';
import { isSingleTurnConversation } from '../adapters/legacy-adapter';
import { getAgentJobType } from '../utils/agent-utils';
import { preflightConversationExecution } from '../lib/conversationPreflight';

const router = Router();

interface ExecuteTestRequest {
	agent_id: number;
	test_id: number;
}

interface ExecuteConversationRequest {
	agent_id: number;
	conversation_id: number;
}

// Execute a test with a specific agent (maps to conversation execution)
router.post('/', (async (req: Request<{}, {}, ExecuteTestRequest>, res: Response) => {
	try {
		const { agent_id, test_id } = req.body;

		// Validate input
		if (!agent_id || !test_id) {
			return res.status(400).json({ error: 'agent_id and test_id are required' });
		}

		// Resolve legacy id mapping
		const conversationId = testIdToConversationId(test_id) ?? test_id;

		// Get agent and conversation (resolved)
		const agent = await getAgentById(agent_id);
		const conversation = await getConversationById(conversationId);

		// Check if agent and conversation exist
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}
		if (!conversation) {
			return res.status(404).json({ error: 'Test not found' });
		}

		// Verify this is a single-turn conversation (valid as a "test")
		const messages = await getConversationMessages(conversationId);
		if (!isSingleTurnConversation(conversation, messages)) {
			return res.status(400).json({ error: 'Cannot execute multi-turn conversation as legacy test' });
		}

		// Create a conversation job (legacy tests are now single-turn conversations)
		const jobId = await jobQueue.createConversationJob(agent_id, conversationId);

		// Return the job ID with 202 Accepted status
		return res.status(202).json({
			job_id: jobId,
			message: 'Test execution job created and queued for execution'
		});
	} catch (error: any) {
		console.error('Error executing test:', error);
		return res.status(500).json({ error: 'Failed to execute test', details: error instanceof Error ? error.message : 'Unknown error' });
	}
}) as any);

// Execute a conversation with a specific agent
router.post('/conversation', (async (req: Request<{}, {}, ExecuteConversationRequest>, res: Response) => {
	try {
		const { agent_id, conversation_id } = req.body;

		// Validate input
		if (!agent_id || !conversation_id) {
			return res.status(400).json({ error: 'agent_id and conversation_id are required' });
		}

		// Get agent and conversation from database
		const agent = await getAgentById(agent_id);
		const conversation = await getConversationById(conversation_id);

		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}
		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		// Preflight validation before enqueueing
		const jobType = getAgentJobType(agent.settings);

		if (jobType === 'external_api') {
			const messages = await getConversationMessages(conversation_id);
			const templates = templateRepo.getAgentTemplates(agent_id);
			const maps = templateRepo.getAgentResponseMaps(agent_id);
			const preflight = preflightConversationExecution({
				agent_job_type: jobType,
				conversation,
				messages,
				agent_templates: templates.map(t => ({
					id: t.id!,
					is_default: t.is_default,
					capabilities: t.capability ?? null
				})),
				agent_response_maps: maps.map(m => ({
					id: m.id!,
					is_default: m.is_default,
					capabilities: m.capability ?? null
				}))
			});
			if (!preflight.ok) {
				return res.status(400).json({
					error: 'Conversation cannot be executed with this agent',
					code: 'CONVERSATION_PREFLIGHT_FAILED',
					details: preflight.errors
				});
			}
		} else {
			// If this conversation declares external API capability requirements, fail early for non-external_api agents.
			const preflight = preflightConversationExecution({
				agent_job_type: jobType,
				conversation,
				messages: [],
				agent_templates: [],
				agent_response_maps: []
			});
			if (!preflight.ok) {
				return res.status(400).json({
					error: 'Conversation cannot be executed with this agent',
					code: 'CONVERSATION_PREFLIGHT_FAILED',
					details: preflight.errors
				});
			}
		}

		// Create a job to execute the conversation
		const jobId = await jobQueue.createConversationJob(agent_id, conversation_id);

		// Return the job ID with 202 Accepted status
		return res.status(202).json({
			job_id: jobId,
			message: 'Conversation execution job created and queued for execution'
		});
	} catch (error: any) {
		console.error('Error executing conversation:', error);
		return res.status(500).json({ error: 'Failed to execute conversation', details: error instanceof Error ? error.message : 'Unknown error' });
	}
}) as any);

export default router;
