import { Router } from 'express';
import type { Request, Response } from 'express';
import { createResult, getResults, getResultById } from '../db/queries';
import type { TestResult } from '../types';

const router = Router();

// Get all results with optional filters
router.get('/', (async (req: Request, res: Response) => {
    try {
        const { agent_id, test_id } = req.query;
        const filters = {
            ...(agent_id && { agent_id: Number(agent_id) }),
            ...(test_id && { test_id: Number(test_id) }),
        };
        const results = await getResults(filters);
        res.json(results);
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
}) as any);

// Get result by ID
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const result = await getResultById(Number(req.params.id));
        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }
        res.json(result);
    } catch (error) {
        console.error('Error fetching result:', error);
        res.status(500).json({ error: 'Failed to fetch result' });
    }
}) as any);

// Create new result
router.post('/', (async (req: Request<{}, {}, Omit<TestResult, 'id' | 'created_at'>>, res: Response) => {
    try {
        const result = await createResult(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating result:', error);
        res.status(500).json({ error: 'Failed to create result' });
    }
}) as any);

export default router; 