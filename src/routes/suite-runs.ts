import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSuiteRunById, getJobsBySuiteRunId, deleteSuiteRun, getExecutionTimeByResultId, listSuiteRunsWithCount } from '../db/queries';
import { paginationConfig } from '../config';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';
import db from '../db/database';
import { JobStatus } from '../types';

const router = Router();

/**
 * Utility function to recalculate and enrich suite run data with accurate progress and execution time
 * This handles cases where older data wasn't stored properly in the database
 */
async function enrichSuiteRunWithCalculatedFields(suiteRun: any) {
	const jobs = await getJobsBySuiteRunId(suiteRun.id!);
	
	// Calculate actual job states
	const completedJobs = jobs.filter(job => 
		job.status === 'completed' || 
		job.status === 'failed' || 
		job.status === 'timeout'
	);
	const successfulJobs = jobs.filter(job => job.status === 'completed');
	
	// If the database values don't match the actual job states, use calculated values
	// this is a fallback to ensure the UI is always up to date
	if (suiteRun.completed_tests !== completedJobs.length || 
		suiteRun.successful_tests !== successfulJobs.length) {
		
		suiteRun.completed_tests = completedJobs.length;
		suiteRun.successful_tests = successfulJobs.length;
		suiteRun.failed_tests = completedJobs.length - successfulJobs.length;
		suiteRun.progress = Math.floor((completedJobs.length / Math.max(jobs.length, 1)) * 100);
		
		// Update status if all jobs are completed
		if (completedJobs.length === jobs.length && jobs.length > 0) {
			suiteRun.status = 'completed' as any;
		} else if (jobs.some(job => job.status === 'running')) {
			suiteRun.status = 'running' as any;
		}
	}

	// Fallback: compute total_execution_time if missing or zero
	if (!suiteRun.total_execution_time && suiteRun.completed_tests > 0) {
		const sumMs = jobs
			.map(j => j.result_id)
			.filter((id): id is number => id !== undefined && id !== null)
			.map(id => (getExecutionTimeByResultId(id) || 0) * 1000)
			.reduce((s, t) => s + t, 0);
		suiteRun.total_execution_time = sumMs;
	}

	// Calculate average similarity score (server-side to avoid heavy client work)
	try {
		const startTime = suiteRun.started_at;
		const endTime = suiteRun.completed_at || new Date().toISOString();
		const stmt = db.prepare(`
			SELECT AVG(similarity_score) as avg_score
			FROM results
			WHERE agent_id = ?
				AND created_at >= ?
				AND created_at <= ?
				AND similarity_score IS NOT NULL
				AND similarity_scoring_status = 'completed'
		`);
		const row = stmt.get(suiteRun.agent_id, startTime, endTime) as { avg_score: number | null };
		if (row && row.avg_score !== null) {
			suiteRun.avg_similarity_score = row.avg_score;
		}
	} catch (err) {
		console.error('Failed to compute average similarity score for suite run', suiteRun.id, err);
	}
	
	return suiteRun;
}

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

		// If pagination parameters are provided, return with count
		if (hasPaginationParams(req)) {
			const paginationParams = validatePaginationOrError(req, res);
			if (!paginationParams) return; // Error response already sent

			const { data, total } = listSuiteRunsWithCount({ ...filters, ...paginationParams });
			return res.json({
				data,
				total,
				limit: paginationParams.limit,
				offset: paginationParams.offset || 0
			});
		}

		// Otherwise apply default pagination limit
		const defaultLimit = paginationConfig.defaultLargeLimit;
		const { data, total } = listSuiteRunsWithCount({ ...filters, limit: defaultLimit, offset: 0 });

		return res.json({
			data,
			total,
			limit: defaultLimit,
			offset: 0
		});
	} catch (error) {
		console.error('Error fetching suite runs:', error);
		return res.status(500).json({ error: 'Failed to fetch suite runs' });
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

		// Apply recalculation logic
		const enrichedSuiteRun = await enrichSuiteRunWithCalculatedFields(suiteRun);
		
		return res.json(enrichedSuiteRun);
	} catch (error) {
		console.error(`Error getting suite run ${req.params.id}:`, error);
		return res.status(500).json({
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
		return res.json(jobs);
	} catch (error) {
		console.error(`Error getting jobs for suite run ${req.params.id}:`, error);
		return res.status(500).json({
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

		return res.status(204).send();
	} catch (error) {
		console.error(`Error deleting suite run ${req.params.id}:`, error);
		return res.status(500).json({
			error: 'Failed to delete suite run',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

export default router;
