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

export default router;
