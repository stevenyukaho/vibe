import { Router } from 'express';
import type { Request, Response } from 'express';
import { 
	getExecutionSessions,
	getExecutionSessionsWithCount,
	getExecutionSessionById,
	updateExecutionSession,
	getSessionMessages,
	getFullSessionTranscript,
	createExecutionSession
} from '../db/queries';
import type { ExecutionSession } from '../types';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';

const router = Router();

// Get all execution sessions
router.get('/', (async (req: Request, res: Response) => {
	try {
		const { conversation_id, agent_id } = req.query as { conversation_id?: string; agent_id?: string };

		// Base filters without pagination applied yet
		const baseFilters: { conversation_id?: number; agent_id?: number } = {
			...(conversation_id ? { conversation_id: Number(conversation_id) } : {}),
			...(agent_id ? { agent_id: Number(agent_id) } : {})
		};

		// If client supplied pagination, honor it
		if (hasPaginationParams(req)) {
			const paginationParams = validatePaginationOrError(req, res);
			if (!paginationParams) {
				return;
			}

			const { data, total } = getExecutionSessionsWithCount({ ...baseFilters, ...paginationParams });
			return res.json({
				data,
				total,
				limit: paginationParams.limit,
				offset: paginationParams.offset || 0
			});
		}

		// Otherwise get all sessions (with base filters)
		const sessions = await getExecutionSessions(baseFilters);
		return res.json(sessions);
	} catch (error) {
		console.error('Error fetching execution sessions:', error);
		return res.status(500).json({ error: 'Failed to fetch execution sessions' });
	}
}) as any);

// Get execution session by id
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const sessionId = Number(req.params.id);
		const session = await getExecutionSessionById(sessionId);
		
		if (!session) {
			return res.status(404).json({ error: 'Execution session not found' });
		}

		return res.json(session);
	} catch (error) {
		console.error('Error fetching execution session:', error);
		return res.status(500).json({ error: 'Failed to fetch execution session' });
	}
}) as any);

// Get session messages (transcript)
router.get('/:id/messages', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const sessionId = Number(req.params.id);
		
		// Check if session exists
		const session = await getExecutionSessionById(sessionId);
		if (!session) {
			return res.status(404).json({ error: 'Execution session not found' });
		}

		const messages = await getSessionMessages(sessionId);
		return res.json(messages);
	} catch (error) {
		console.error('Error fetching session messages:', error);
		return res.status(500).json({ error: 'Failed to fetch session messages' });
	}
}) as any);

// Get full session transcript (session details + messages)
router.get('/:id/transcript', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const sessionId = Number(req.params.id);
		
		const transcript = await getFullSessionTranscript(sessionId);
		
		if (!transcript.session) {
			return res.status(404).json({ error: 'Execution session not found' });
		}

		return res.json(transcript);
	} catch (error) {
		console.error('Error fetching session transcript:', error);
		return res.status(500).json({ error: 'Failed to fetch session transcript' });
	}
}) as any);

// Update execution session (for status updates, completion, etc.)
router.put('/:id', (async (req: Request<{ id: string }, {}, Partial<ExecutionSession>>, res: Response) => {
	try {
		const sessionId = Number(req.params.id);
		
		// Check if session exists
		const existingSession = await getExecutionSessionById(sessionId);
		if (!existingSession) {
			return res.status(404).json({ error: 'Execution session not found' });
		}

		const updatedSession = await updateExecutionSession(sessionId, req.body);
		return res.json(updatedSession);
	} catch (error) {
		console.error('Error updating execution session:', error);
		return res.status(500).json({ error: 'Failed to update execution session' });
	}
}) as any);

// Create execution session (for agent services)
router.post('/', (async (req: Request<{}, {}, Partial<ExecutionSession>>, res: Response) => {
	try {
		const session = await createExecutionSession(req.body as ExecutionSession);
		return res.status(201).json(session);
	} catch (error) {
		console.error('Error creating execution session:', error);
		return res.status(500).json({ error: 'Failed to create execution session' });
	}
}) as any);

// Cancel/delete execution session
router.delete('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const sessionId = Number(req.params.id);

		// Check if session exists
		const existingSession = await getExecutionSessionById(sessionId);
		if (!existingSession) {
			return res.status(404).json({ error: 'Execution session not found' });
		}

		// We'll just mark as failed rather than actually deleting
		// This preserves the execution history
		await updateExecutionSession(sessionId, { 
			status: 'failed',
			error_message: 'Session cancelled by user',
			completed_at: new Date().toISOString()
		});

		return res.status(204).send();
	} catch (error) {
		console.error('Error cancelling execution session:', error);
		return res.status(500).json({
			error: 'Failed to cancel execution session',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

export default router;
