import { Router } from 'express';
import type { Request, Response } from 'express';
import { createTest, getTests, getTestById, updateTest } from '../db/queries';
import type { Test } from '../db/queries';

const router = Router();

// Get all tests
router.get('/', (async (_req: Request, res: Response) => {
    try {
        const tests = await getTests();
        res.json(tests);
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ error: 'Failed to fetch tests' });
    }
}) as any);

// Get test by ID
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const test = await getTestById(Number(req.params.id));
        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }
        res.json(test);
    } catch (error) {
        console.error('Error fetching test:', error);
        res.status(500).json({ error: 'Failed to fetch test' });
    }
}) as any);

// Create new test
router.post('/', (async (req: Request<{}, {}, Omit<Test, 'id' | 'created_at' | 'updated_at'>>, res: Response) => {
    try {
        const test = await createTest(req.body);
        res.status(201).json(test);
    } catch (error) {
        console.error('Error creating test:', error);
        res.status(500).json({ error: 'Failed to create test' });
    }
}) as any);

// Update test
router.put('/:id', (async (req: Request<{ id: string }, {}, Partial<Test>>, res: Response) => {
    try {
        const test = await updateTest(Number(req.params.id), req.body);
        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }
        res.json(test);
    } catch (error) {
        console.error('Error updating test:', error);
        res.status(500).json({ error: 'Failed to update test' });
    }
}) as any);

export default router; 