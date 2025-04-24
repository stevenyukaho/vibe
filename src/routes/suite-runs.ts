import { Router } from 'express';
import type { Request, Response } from 'express';
import { listSuiteRuns, getSuiteRunById, getJobsBySuiteRunId, deleteSuiteRun } from '../db/queries';
import { JobStatus } from '../types';

const router = Router();

/**
 * GET /api/suite-runs
 * List all suite runs with optional filtering
 */
router.get('/', (async (req: Request, res: Response) => {
	try {
		const filters: any = {};

		// Apply filters from query parameters
		if (req.query.status) {
			filters.status = req.query.status as JobStatus;
		}

		if (req.query.suite_id) {
			filters.suite_id = parseInt(req.query.suite_id as string, 10);
		}

		if (req.query.agent_id) {
			filters.agent_id = parseInt(req.query.agent_id as string, 10);
		}

		if (req.query.before) {
			filters.before = new Date(req.query.before as string);
		}

		if (req.query.after) {
			filters.after = new Date(req.query.after as string);
		}

		const suiteRuns = await listSuiteRuns(filters);
		res.json(suiteRuns);
	} catch (error) {
		console.error('Error listing suite runs:', error);
		res.status(500).json({
			error: 'Failed to list suite runs',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

/**
 * GET /api/suite-runs/:id
 * Get details of a specific suite run
 */
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid suite run ID' });
		}

		const suiteRun = await getSuiteRunById(id);
		if (!suiteRun) {
			return res.status(404).json({ error: 'Suite run not found' });
		}

		res.json(suiteRun);
	} catch (error) {
		console.error(`Error getting suite run ${req.params.id}:`, error);
		res.status(500).json({
			error: 'Failed to get suite run',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

/**
 * GET /api/suite-runs/:id/jobs
 * Get jobs associated with a suite run
 */
router.get('/:id/jobs', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid suite run ID' });
		}

		// First check if the suite run exists
		const suiteRun = await getSuiteRunById(id);
		if (!suiteRun) {
			return res.status(404).json({ error: 'Suite run not found' });
		}

		const jobs = await getJobsBySuiteRunId(id);
		res.json(jobs);
	} catch (error) {
		console.error(`Error getting jobs for suite run ${req.params.id}:`, error);
		res.status(500).json({
			error: 'Failed to get jobs for suite run',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

/**
 * DELETE /api/suite-runs/:id
 * Delete a suite run and its associated jobs
 */
router.delete('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid suite run ID' });
		}

		// Check if the suite run exists
		const suiteRun = await getSuiteRunById(id);
		if (!suiteRun) {
			return res.status(404).json({ error: 'Suite run not found' });
		}

		// Delete the suite run and associated jobs
		await deleteSuiteRun(id);

		res.status(204).send();
	} catch (error) {
		console.error(`Error deleting suite run ${req.params.id}:`, error);
		res.status(500).json({
			error: 'Failed to delete suite run',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

export default router;
