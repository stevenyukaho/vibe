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
	getTestSuitesWithCount
} from '../db/queries';
import { suiteProcessingService } from '../services/suite-processing-service';
import {
	getEntriesInSuite,
	addSuiteEntry,
	updateSuiteEntryOrder,
	deleteSuiteEntry,
	reorderSuiteEntries
} from '../db/queries';
import type { TestSuite } from '../types';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';

const router = Router();

/**
 * GET /api/test-suites
 * Get all test suites with test counts
 */
router.get('/', (async (req: Request, res: Response) => {
	try {
		if (hasPaginationParams(req)) {
			const paginationParams = validatePaginationOrError(req, res);
			if (!paginationParams) {
				return;
			}

			const { data, total } = getTestSuitesWithCount(paginationParams);
			const suitesWithCounts = data.map((suite: TestSuite) => {
				let testCount = 0;
				try {
					testCount = suiteProcessingService.countLeafTests(suite.id!);
				} catch (error) {
					console.warn(`Error calculating test count for suite ${suite.id}:`, error);
				}
				return { ...suite, test_count: testCount };
			});

			return res.json({ data: suitesWithCounts, total, ...paginationParams });
		}

		const suites = getTestSuites();
		const suitesWithCounts = suites.map((suite: TestSuite) => {
			let testCount = 0;
			try {
				testCount = suiteProcessingService.countLeafTests(suite.id!);
			} catch (error) {
				console.warn(`Error calculating test count for suite ${suite.id}:`, error);
			}
			return { ...suite, test_count: testCount };
		});

		return res.json(suitesWithCounts);
	} catch (error) {
		console.error('Error fetching test suites:', error);
		return res.status(500).json({ error: 'Failed to fetch test suites' });
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

		return res.json(testSuite);
	} catch (error) {
		console.error(`Error fetching test suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to fetch test suite' });
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
		return res.status(201).json(testSuite);
	} catch (error) {
		console.error('Error creating test suite:', error);
		return res.status(500).json({ error: 'Failed to create test suite' });
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
		return res.json(updatedTestSuite);
	} catch (error) {
		console.error(`Error updating test suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to update test suite' });
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
		return res.status(204).send();
	} catch (error) {
		console.error(`Error deleting test suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to delete test suite' });
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
		return res.json(tests);
	} catch (error) {
		console.error(`Error fetching tests for suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to fetch tests for suite' });
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
		return res.status(201).json(result);
	} catch (error) {
		console.error(`Error adding test to suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to add test to suite' });
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
		return res.status(204).send();
	} catch (error) {
		console.error(`Error removing test ${req.params.testId} from suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to remove test from suite' });
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
		return res.status(200).json({ success: true });
	} catch (error) {
		console.error(`Error reordering tests in suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to reorder tests in suite' });
	}
}) as any);

/**
 * GET /api/test-suites/:id/entries
 * Get all entries in a suite
 */
router.get('/:id/entries', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseInt(req.params.id);
		if (isNaN(suiteId)) {
			return res.status(400).json({ error: 'Invalid test suite ID' });
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(suiteId);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		const entries = getEntriesInSuite(suiteId);
		return res.json(entries);
	} catch (error) {
		console.error(`Error fetching entries for suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to fetch entries for suite' });
	}
}) as any);

/**
 * POST /api/test-suites/:id/entries
 * Add an entry to a suite
 */
router.post('/:id/entries', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseInt(req.params.id);
		if (isNaN(suiteId)) {
			return res.status(400).json({ error: 'Invalid test suite ID' });
		}

		const { sequence, test_id, child_suite_id, agent_id_override } = req.body;

		if (!test_id && !child_suite_id) {
			return res.status(400).json({ error: 'Either test_id or child_suite_id must be provided' });
		}

		if (test_id && child_suite_id) {
			return res.status(400).json({ error: 'Cannot specify both test_id and child_suite_id' });
		}

		const existingTestSuite = await getTestSuiteById(suiteId);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		const entry = addSuiteEntry({
			parent_suite_id: suiteId,
			sequence,
			test_id: test_id ? parseInt(test_id) : undefined,
			child_suite_id: child_suite_id ? parseInt(child_suite_id) : undefined,
			agent_id_override: agent_id_override ? parseInt(agent_id_override) : undefined
		});

		return res.status(201).json(entry);
	} catch (error) {
		console.error(`Error adding entry to suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to add entry to suite' });
	}
}) as any);

/**
 * PUT /api/test-suites/:id/entries/:entryId
 * Update a suite entry
 */
router.put('/:id/entries/:entryId', (async (req: Request<{ id: string, entryId: string }>, res: Response) => {
	try {
		const entryId = parseInt(req.params.entryId);
		if (isNaN(entryId)) {
			return res.status(400).json({ error: 'Invalid entry ID' });
		}

		const { sequence, agent_id_override } = req.body;

		updateSuiteEntryOrder(entryId, sequence, agent_id_override);
		return res.json({ message: 'Entry updated successfully' });
	} catch (error) {
		console.error(`Error updating entry ${req.params.entryId}:`, error);
		return res.status(500).json({ error: 'Failed to update entry' });
	}
}) as any);

/**
 * DELETE /api/test-suites/:id/entries/:entryId
 * Delete a suite entry
 */
router.delete('/:id/entries/:entryId', (async (req: Request<{ id: string, entryId: string }>, res: Response) => {
	try {
		const entryId = parseInt(req.params.entryId);
		if (isNaN(entryId)) {
			return res.status(400).json({ error: 'Invalid entry ID' });
		}

		deleteSuiteEntry(entryId);
		return res.status(204).send();
	} catch (error) {
		console.error(`Error deleting entry ${req.params.entryId}:`, error);
		return res.status(500).json({ error: 'Failed to delete entry' });
	}
}) as any);

/**
 * PUT /api/test-suites/:id/entries/reorder
 * Reorder entries in a suite
 */
router.put('/:id/entries/reorder', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseInt(req.params.id);
		if (isNaN(suiteId)) {
			return res.status(400).json({ error: 'Invalid test suite ID' });
		}

		const { entry_orders } = req.body;
		if (!Array.isArray(entry_orders)) {
			return res.status(400).json({ error: 'entry_orders must be an array' });
		}

		// Validate entry_orders format
		for (const order of entry_orders) {
			if (!order.entry_id || !order.sequence || isNaN(parseInt(order.entry_id)) || isNaN(parseInt(order.sequence))) {
				return res.status(400).json({ error: 'Each entry order must have valid entry_id and sequence' });
			}
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(suiteId);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		reorderSuiteEntries(suiteId, entry_orders);
		return res.json({ message: 'Entries reordered successfully' });
	} catch (error) {
		console.error(`Error reordering entries in suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to reorder entries' });
	}
}) as any);

export default router;
