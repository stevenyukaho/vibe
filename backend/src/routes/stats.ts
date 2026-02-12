import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAgentsCount, getSingleTurnTestsCount } from '../db/queries';
import { shouldLog } from '../lib/logger';

const router = Router();

/**
 * GET /api/stats
 * Minimal stats payload for dashboard counts
 */
router.get('/', (async (_req: Request, res: Response) => {
	try {
		const agents_total = getAgentsCount();
		const tests_total = getSingleTurnTestsCount();

		return res.json({ agents_total, tests_total });
	} catch (error) {
		/* istanbul ignore next */
		if (shouldLog) {
			console.error('Error fetching stats:', error);
		}
		return res.status(500).json({ error: 'Failed to fetch stats' });
	}
}) as any);

export default router;
