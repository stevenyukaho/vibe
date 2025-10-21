import { Router } from 'express';
import type { Request, Response } from 'express';
import { addSessionMessage } from '../db/queries';
import type { SessionMessage } from '../types';

const router = Router();

// Create session message
router.post('/', (async (req: Request<{}, {}, Omit<SessionMessage, 'id'>>, res: Response) => {
	try {
		// Normalize payload for SQLite bindings
		const payload: any = { ...(req.body || {}) };

		// Required fields
		if (payload.session_id !== undefined) {
			payload.session_id = Number(payload.session_id);
		}
		if (payload.sequence !== undefined) {
			payload.sequence = Number(payload.sequence);
		}

		// Ensure role and content are strings (content default to empty string to satisfy named param)
		if (payload.role === undefined || payload.role === null) {
			payload.role = 'assistant';
		}
		if (typeof payload.role !== 'string') {
			payload.role = String(payload.role);
		}
		if (payload.content === undefined || payload.content === null) {
			payload.content = '';
		}
		if (typeof payload.content !== 'string') {
			payload.content = String(payload.content);
		}

		// Ensure timestamp is a string if provided
		if (payload.timestamp && typeof payload.timestamp !== 'string') {
			payload.timestamp = new Date(payload.timestamp).toISOString();
		}

		// Ensure metadata is a string or null
		if (payload.metadata === undefined || payload.metadata === null) {
			payload.metadata = null;
		} else if (typeof payload.metadata !== 'string') {
			try {
				payload.metadata = JSON.stringify(payload.metadata);
			} catch (_e) {
				payload.metadata = null;
			}
		}

		const message = await addSessionMessage(payload as SessionMessage);
		return res.status(201).json(message);
	} catch (error) {
		console.error('Error creating session message:', error);
		return res.status(500).json({ error: 'Failed to create session message' });
	}
}) as any);

// Regenerate similarity score for a specific message
router.post('/:id/regenerate-score', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const messageId = Number(req.params.id);
		if (isNaN(messageId)) {
			return res.status(400).json({ error: 'Invalid message ID' });
		}

		// Get the message
		const message = await getSessionMessageById(messageId);
		if (!message) {
			return res.status(404).json({ error: 'Message not found' });
		}

		if (message.role !== 'assistant') {
			return res.status(400).json({ error: 'Only assistant messages can be scored' });
		}

		// Get the session and conversation
		const session = await getExecutionSessionById(message.session_id);
		if (!session?.conversation_id) {
			return res.status(400).json({ error: 'Session or conversation not found' });
		}

		// Determine user turn index k up to this assistant message
		const k = countUserTurnsUpTo(message.session_id, message.sequence);
		const target = getConversationTurnTarget(session.conversation_id, k);
		if (!target || !target.id) {
			return res.status(400).json({ error: 'No target found for this turn' });
		}

		// Mark as pending and start scoring
		updateSessionMessage(messageId, { similarity_scoring_status: 'pending' });

		// Run scoring in background
		scoreSessionMessageSimilarity(messageId, target.target_reply, message.content, k, target.id);

		return res.status(202).json({
			message: 'Similarity scoring initiated',
			message_id: messageId
		});
	} catch (error) {
		console.error('Error regenerating similarity score:', error);
		return res.status(500).json({ error: 'Failed to regenerate similarity score' });
	}
}) as any);

export default router;
