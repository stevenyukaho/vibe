import { Router } from 'express';
import type { Request, Response } from 'express';
import { addSessionMessage } from '../db/queries';
import type { SessionMessage } from '../types';

const router = Router();

// Create session message
router.post('/', (async (req: Request<{}, {}, Omit<SessionMessage, 'id'>>, res: Response) => {
	try {
		const message = await addSessionMessage(req.body);
		return res.status(201).json(message);
	} catch (error) {
		console.error('Error creating session message:', error);
		return res.status(500).json({ error: 'Failed to create session message' });
	}
}) as any);

export default router;
