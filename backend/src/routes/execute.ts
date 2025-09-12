import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAgentById, getConversationById, getConversationMessages } from '../db/queries';
import { testIdToConversationId } from '../lib/legacyIdResolver';
import { jobQueue } from '../services/job-queue';
import { isSingleTurnConversation } from '../adapters/legacy-adapter';

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
