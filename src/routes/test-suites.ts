import { Router } from 'express';
import type { Request, Response } from 'express';
import { 
    createTestSuite, 
    getTestSuites, 
    getTestSuiteById, 
    updateTestSuite, 
    deleteTestSuite,
    addTestToSuite,
    removeTestFromSuite,
    getTestsInSuite,
    reorderTestsInSuite,
    getEntriesInSuite,
    addSuiteEntry,
    updateSuiteEntryOrder,
    deleteSuiteEntry,
    reorderSuiteEntries
} from '../db/queries';

const router = Router();

/**
 * GET /api/test-suites
 * Get all test suites
 */
router.get('/', (async (_req: Request, res: Response) => {
    try {
        const testSuites = getTestSuites();
        res.json(testSuites);
    } catch (error) {
        console.error('Error fetching test suites:', error);
        res.status(500).json({ error: 'Failed to fetch test suites' });
    }
}) as any);

/**
 * GET /api/test-suites/:id
 * Get a specific test suite by ID
 */
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid test suite ID' });
        }

        const testSuite = await getTestSuiteById(id);
        if (!testSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        res.json(testSuite);
    } catch (error) {
        console.error(`Error fetching test suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch test suite' });
    }
}) as any);

/**
 * POST /api/test-suites
 * Create a new test suite
 */
router.post('/', (async (req: Request, res: Response) => {
    try {
        const { name, description, tags } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Test suite name is required' });
        }

        const testSuite = createTestSuite({ name, description, tags });
        res.status(201).json(testSuite);
    } catch (error) {
        console.error('Error creating test suite:', error);
        res.status(500).json({ error: 'Failed to create test suite' });
    }
}) as any);

/**
 * PUT /api/test-suites/:id
 * Update a test suite
 */
router.put('/:id', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid test suite ID' });
        }

        const { name, description, tags } = req.body;
        
        // Check if test suite exists
        const existingTestSuite = await getTestSuiteById(id);
        if (!existingTestSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        const updatedTestSuite = updateTestSuite(id, { name, description, tags });
        res.json(updatedTestSuite);
    } catch (error) {
        console.error(`Error updating test suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to update test suite' });
    }
}) as any);

/**
 * DELETE /api/test-suites/:id
 * Delete a test suite
 */
router.delete('/:id', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid test suite ID' });
        }

        // Check if test suite exists
        const existingTestSuite = await getTestSuiteById(id);
        if (!existingTestSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        deleteTestSuite(id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting test suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to delete test suite' });
    }
}) as any);

/**
 * GET /api/test-suites/:id/tests
 * Get all tests in a suite
 */
router.get('/:id/tests', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid test suite ID' });
        }

        // Check if test suite exists
        const existingTestSuite = await getTestSuiteById(id);
        if (!existingTestSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        const tests = getTestsInSuite(id);
        res.json(tests);
    } catch (error) {
        console.error(`Error fetching tests for suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch tests for suite' });
    }
}) as any);

/**
 * POST /api/test-suites/:id/tests
 * Add a test to a suite
 */
router.post('/:id/tests', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const suiteId = parseInt(req.params.id);
        if (isNaN(suiteId)) {
            return res.status(400).json({ error: 'Invalid test suite ID' });
        }

        const { test_id, sequence } = req.body;
        if (!test_id || isNaN(parseInt(test_id))) {
            return res.status(400).json({ error: 'Valid test ID is required' });
        }

        // Check if test suite exists
        const existingTestSuite = await getTestSuiteById(suiteId);
        if (!existingTestSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        const testId = parseInt(test_id);
        const result = addTestToSuite(suiteId, testId, sequence);
        res.status(201).json(result);
    } catch (error) {
        console.error(`Error adding test to suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to add test to suite' });
    }
}) as any);

/**
 * DELETE /api/test-suites/:id/tests/:testId
 * Remove a test from a suite
 */
router.delete('/:id/tests/:testId', (async (req: Request<{ id: string, testId: string }>, res: Response) => {
    try {
        const suiteId = parseInt(req.params.id);
        const testId = parseInt(req.params.testId);
        
        if (isNaN(suiteId) || isNaN(testId)) {
            return res.status(400).json({ error: 'Invalid suite ID or test ID' });
        }

        // Check if test suite exists
        const existingTestSuite = await getTestSuiteById(suiteId);
        if (!existingTestSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        removeTestFromSuite(suiteId, testId);
        res.status(204).send();
    } catch (error) {
        console.error(`Error removing test ${req.params.testId} from suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to remove test from suite' });
    }
}) as any);

/**
 * PUT /api/test-suites/:id/tests/reorder
 * Reorder tests within a suite
 */
router.put('/:id/tests/reorder', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const suiteId = parseInt(req.params.id);
        if (isNaN(suiteId)) {
            return res.status(400).json({ error: 'Invalid test suite ID' });
        }

        const { test_orders } = req.body;
        if (!Array.isArray(test_orders) || test_orders.length === 0) {
            return res.status(400).json({ error: 'Valid test orders array is required' });
        }

        // Check if test suite exists
        const existingTestSuite = await getTestSuiteById(suiteId);
        if (!existingTestSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        reorderTestsInSuite(suiteId, test_orders);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(`Error reordering tests in suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to reorder tests in suite' });
    }
}) as any);

/**
 * GET /api/test-suites/:id/entries
 * Get all entries in a suite
 */
router.get('/:id/entries', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid test suite ID' });
        }

        // Check if test suite exists
        const existingTestSuite = await getTestSuiteById(id);
        if (!existingTestSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }

        // Fetch suite entries
        const entries = getEntriesInSuite(id);
        res.json(entries);
    } catch (error) {
        console.error(`Error fetching entries for suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch suite entries' });
    }
}) as any);

/**
 * POST /api/test-suites/:id/entries
 * Add a new entry to a suite
 */
router.post('/:id/entries', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const parent_suite_id = parseInt(req.params.id, 10);
        if (isNaN(parent_suite_id)) {
            return res.status(400).json({ error: 'Invalid suite ID' });
        }

        const { sequence, test_id, child_suite_id, agent_id_override } = req.body;
        const entry = await addSuiteEntry({ parent_suite_id, sequence, test_id, child_suite_id, agent_id_override });
        res.status(201).json(entry);
    } catch (error) {
        console.error(`Error adding entry to suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to add suite entry' });
    }
}) as any);

/**
 * PUT /api/test-suites/:id/entries/:entryId
 * Update an entry (reorder or override)
 */
router.put('/:id/entries/:entryId', (async (req: Request<{ id: string, entryId: string }>, res: Response) => {
    try {
        const entryId = parseInt(req.params.entryId, 10);
        if (isNaN(entryId)) {
            return res.status(400).json({ error: 'Invalid entry ID' });
        }

        const { sequence, agent_id_override } = req.body;
        await updateSuiteEntryOrder(entryId, sequence, agent_id_override);
        res.sendStatus(204);
    } catch (error) {
        console.error(`Error updating entry ${req.params.entryId}:`, error);
        res.status(500).json({ error: 'Failed to update suite entry' });
    }
}) as any);

/**
 * DELETE /api/test-suites/:id/entries/:entryId
 * Remove an entry from a suite
 */
router.delete('/:id/entries/:entryId', (async (req: Request<{ id: string, entryId: string }>, res: Response) => {
    try {
        const entryId = parseInt(req.params.entryId, 10);
        if (isNaN(entryId)) {
            return res.status(400).json({ error: 'Invalid entry ID' });
        }

        await deleteSuiteEntry(entryId);
        res.sendStatus(204);
    } catch (error) {
        console.error(`Error deleting entry ${req.params.entryId}:`, error);
        res.status(500).json({ error: 'Failed to delete suite entry' });
    }
}) as any);

/**
 * PUT /api/test-suites/:id/entries/reorder
 * Bulk reorder entries within a suite
 */
router.put('/:id/entries/reorder', (async (req: Request<{ id: string }>, res: Response) => {
    try {
        const suiteId = parseInt(req.params.id, 10);
        if (isNaN(suiteId)) {
            return res.status(400).json({ error: 'Invalid suite ID' });
        }
        const { entry_orders } = req.body;
        if (!Array.isArray(entry_orders) || entry_orders.length === 0) {
            return res.status(400).json({ error: 'Valid entry_orders array is required' });
        }

        // Check if test suite exists
        const existingSuite = await getTestSuiteById(suiteId);
        if (!existingSuite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }
        // Validate entry orders format
        for (const order of entry_orders) {
            if (typeof order.entry_id !== 'number' || typeof order.sequence !== 'number') {
                return res.status(400).json({ error: 'Invalid entry_orders format' });
            }
        }
        reorderSuiteEntries(suiteId, entry_orders);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error reordering entries in suite ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to reorder suite entries' });
    }
}) as any);

export default router;
