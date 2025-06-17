import { Router } from 'express';
import type { Request, Response } from 'express';
import { createResult, getResultsWithCount, getResultById, getTestById } from '../db/queries';
import type { TestResult } from '../types';
import { scoringService } from '../services/scoring-service';
import { paginationConfig } from '../config';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';

const router = Router();

// Get all results with optional filters
router.get('/', (async (req: Request, res: Response) => {
	try {
		const { agent_id, test_id } = req.query as { agent_id?: string; test_id?: string };

		// Base filters without pagination applied yet
		const baseFilters: { agent_id?: number; test_id?: number } = {
			...(agent_id ? { agent_id: Number(agent_id) } : {}),
			...(test_id ? { test_id: Number(test_id) } : {})
		};

		// If client supplied pagination, honor it
		if (hasPaginationParams(req)) {
			const paginationParams = validatePaginationOrError(req, res);
			if (!paginationParams) {
				return;
			}

			const { data, total } = getResultsWithCount({ ...baseFilters, ...paginationParams });
			return res.json({
				data,
				total,
				limit: paginationParams.limit,
				offset: paginationParams.offset || 0
			});
		}

		// Otherwise fall back to default pagination limit for large tables
		const defaultLimit = paginationConfig.defaultLargeLimit;
		const { data, total } = getResultsWithCount({
			...baseFilters,
			limit: defaultLimit,
			offset: 0
		});

		return res.json({
			data,
			total,
			limit: defaultLimit,
			offset: 0
		});
	} catch (error) {
		console.error('Error fetching results:', error);
		return res.status(500).json({ error: 'Failed to fetch results' });
	}
}) as any);

// Get result by ID
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const result = await getResultById(Number(req.params.id));
		if (!result) {
			return res.status(404).json({ error: 'Result not found' });
		}
		return res.json(result);
	} catch (error) {
		console.error('Error fetching result:', error);
		return res.status(500).json({ error: 'Failed to fetch result' });
	}
}) as any);

// Create new result
router.post('/', (async (req: Request<{}, {}, Omit<TestResult, 'id' | 'created_at'>>, res: Response) => {
	try {
		const result = await createResult(req.body);

		const test = await getTestById(result.test_id);
		if (test?.expected_output) {
			scoringService.scoreTestResult(result, test).catch(error => {
				console.error(`Failed to score result ${result.id}:`, error);
			});
		}

		return res.status(201).json(result);
	} catch (error) {
		console.error('Error creating result:', error);
		return res.status(500).json({ error: 'Failed to create result' });
	}
}) as any);

router.post('/:id/score', (async (req: Request<{ id: string }, {}, { llm_config_id?: number }>, res: Response) => {
	try {
		const resultId = Number(req.params.id);
		if (isNaN(resultId)) {
			return res.status(400).json({ error: 'Invalid result ID' });
		}

		const result = await getResultById(resultId);
		if (!result) {
			return res.status(404).json({ error: 'Result not found' });
		}

		const test = await getTestById(result.test_id);
		if (!test) {
			return res.status(404).json({ error: 'Associated test not found' });
		}

		if (!test.expected_output) {
			return res.status(400).json({ error: 'Test has no expected output to score against' });
		}

		const { llm_config_id } = req.body;

		scoringService.scoreTestResult(result, test, llm_config_id).catch(error => {
			console.error(`Failed to score result ${result.id}:`, error);
		});

		return res.status(202).json({
			message: 'Scoring initiated',
			result_id: resultId
		});
	} catch (error) {
		console.error('Error initiating scoring:', error);
		return res.status(500).json({ error: 'Failed to initiate scoring' });
	}
}) as any);

export default router; 