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
    reorderTestsInSuite
} from '../db/queries';
import { suiteProcessingService } from '../services/suite-processing-service';

const router = Router();

/**
 * GET /api/test-suites
 * Get all test suites with test counts
 */
router.get('/', (async (_req: Request, res: Response) => {
    try {
        const testSuites = getTestSuites();
        
        // Add test count for each suite by counting the nested structure
        const testSuitesWithCounts = testSuites.map(suite => {
            let testCount = 0;
            try {
                // Use the dedicated counting method that doesn't need agent validation
                testCount = suiteProcessingService.countLeafTests(suite.id!);
            } catch (error) {
                console.warn(`Error calculating test count for suite ${suite.id}:`, error);
                testCount = 0;
            }
            
            return {
                ...suite,
                test_count: testCount
            };
        });
        
        res.json(testSuitesWithCounts);
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

export default router;
