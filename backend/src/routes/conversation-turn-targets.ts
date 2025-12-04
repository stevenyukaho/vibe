import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db/database';
import type { ConversationTurnTarget } from '@ibm-vibe/types';

const router = Router();

// Get all turn targets for a conversation
router.get('/conversation/:conversationId', (async (req: Request, res: Response) => {
	try {
		const conversationId = Number(req.params.conversationId);
		const targets = db.prepare(`
			SELECT * FROM conversation_turn_targets
			WHERE conversation_id = ?
			ORDER BY user_sequence
		`).all(conversationId) as ConversationTurnTarget[];

		return res.json(targets);
	} catch (error) {
		console.error('Error fetching turn targets:', error);
		return res.status(500).json({ error: 'Failed to fetch turn targets' });
	}
}) as any);

// Create or update turn target
router.put('/', (async (req: Request, res: Response) => {
	try {
		const { conversation_id, user_sequence, target_reply, threshold, weight } = req.body;

		if (!conversation_id || user_sequence === undefined || !target_reply) {
			return res.status(400).json({ error: 'conversation_id, user_sequence, and target_reply are required' });
		}

		// Check if target already exists
		const exists = db.prepare(`
			SELECT * FROM conversation_turn_targets
			WHERE conversation_id = ? AND user_sequence = ?
		`).get(conversation_id, user_sequence) as ConversationTurnTarget | undefined;

		if (exists) {
			// Update
			const updated = db.prepare(`
				UPDATE conversation_turn_targets
				SET target_reply = ?, threshold = ?, weight = ?, updated_at = CURRENT_TIMESTAMP
				WHERE conversation_id = ? AND user_sequence = ?
				RETURNING *
			`).get(target_reply, threshold, weight, conversation_id, user_sequence) as ConversationTurnTarget;

			return res.json(updated);
		} else {
			// Insert
			const inserted = db.prepare(`
				INSERT INTO conversation_turn_targets (conversation_id, user_sequence, target_reply, threshold, weight)
				VALUES (?, ?, ?, ?, ?)
				RETURNING *
			`).get(conversation_id, user_sequence, target_reply, threshold, weight) as ConversationTurnTarget;

			return res.status(201).json(inserted);
		}
	} catch (error) {
		console.error('Error saving turn target:', error);
		return res.status(500).json({ error: 'Failed to save turn target' });
	}
}) as any);

// Delete turn target
router.delete('/:id', (async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		db.prepare('DELETE FROM conversation_turn_targets WHERE id = ?').run(id);

		return res.status(204).send();
	} catch (error) {
		console.error('Error deleting turn target:', error);

		return res.status(500).json({ error: 'Failed to delete turn target' });
	}
}) as any);

export default router;
