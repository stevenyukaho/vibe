import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	createTestSuite,
	getTestSuites,
	getTestSuiteById,
	updateTestSuite,
	deleteTestSuite,
	getTestSuitesWithCount,
	getEntriesInSuite,
	addSuiteEntry,
	updateSuiteEntryOrder,
	deleteSuiteEntry,
	reorderSuiteEntries,
	getConversationById,
	getConversationMessages
} from '../db/queries';
import { suiteProcessingService } from '../services/suite-processing-service';
import {
	conversationToLegacyTest,
	isSingleTurnConversation
} from '../adapters/legacy-adapter';
import type { TestSuite } from '@ibm-vibe/types';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';
import { logError, logWarn } from '../lib/logger';
import { parseIdParam } from '../lib/routeHelpers';

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
					logWarn(`Error calculating test count for suite ${suite.id}:`, error);
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
				logWarn(`Error calculating test count for suite ${suite.id}:`, error);
			}
			return { ...suite, test_count: testCount };
		});

		return res.json(suitesWithCounts);
	} catch (error) {
		logError('Error fetching test suites:', error);
		return res.status(500).json({ error: 'Failed to fetch test suites' });
	}
}) as any);

/**
 * GET /api/test-suites/:id
 * Get a specific test suite by ID
 */
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (id === null) {
			return;
		}

		const testSuite = await getTestSuiteById(id);
		if (!testSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		return res.json(testSuite);
	} catch (error) {
		logError(`Error fetching test suite ${req.params.id}:`, error);
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
		logError('Error creating test suite:', error);
		return res.status(500).json({ error: 'Failed to create test suite' });
	}
}) as any);

/**
 * PUT /api/test-suites/:id
 * Update a test suite
 */
router.put('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (id === null) {
			return;
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
		logError(`Error updating test suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to update test suite' });
	}
}) as any);

/**
 * DELETE /api/test-suites/:id
 * Delete a test suite
 */
router.delete('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (id === null) {
			return;
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(id);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		deleteTestSuite(id);
		return res.status(204).send();
	} catch (error) {
		logError(`Error deleting test suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to delete test suite' });
	}
}) as any);

/**
 * GET /api/test-suites/:id/tests
 * Get all tests in a suite
 */
router.get('/:id/tests', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (id === null) {
			return;
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(id);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		// Get entries from new suite_entries table
		const entries = getEntriesInSuite(id);

		// Transform conversation entries to legacy test format
		const tests = await Promise.all(
			entries
				.filter(entry => entry.conversation_id) // Only conversation entries (not nested suites)
				.map(async (entry) => {
					try {
						const conversation = await getConversationById(entry.conversation_id!);
						if (!conversation) return null;

						const messages = await getConversationMessages(entry.conversation_id!);

						// Only include single-turn conversations as "tests"
						if (isSingleTurnConversation(conversation, messages)) {
							const legacyTest = conversationToLegacyTest(conversation, messages);
							return {
								...legacyTest,
								sequence: entry.sequence
							};
						}
						return null;
					} catch (error) {
						logWarn(`Error processing entry ${entry.id}:`, error);
						return null;
					}
				})
		);

		// Filter out null values and sort by sequence
		const validTests = tests
			.filter(test => test !== null)
			.sort((a, b) => (a?.sequence || 0) - (b?.sequence || 0));

		return res.json(validTests);
	} catch (error) {
		logError(`Error fetching tests for suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to fetch tests for suite' });
	}
}) as any);

/**
 * POST /api/test-suites/:id/tests
 * Add a test to a suite
 */
router.post('/:id/tests', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (suiteId === null) {
			return;
		}

		const { test_id, sequence } = req.body;
		if (!test_id) {
			return res.status(400).json({ error: 'Valid test ID is required' });
		}
		const conversationId = parseIdParam(res, String(test_id), 'Valid test ID is required');
		if (conversationId === null) {
			return;
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(suiteId);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		// Verify the conversation exists and is single-turn (valid as a "test")
		const conversation = await getConversationById(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: 'Test not found' });
		}

		const messages = await getConversationMessages(conversationId);
		if (!isSingleTurnConversation(conversation, messages)) {
			return res.status(400).json({ error: 'Cannot add multi-turn conversation as test to suite' });
		}

		// Add entry to suite_entries table using conversation_id
		const result = addSuiteEntry({
			parent_suite_id: suiteId,
			conversation_id: conversationId,
			sequence: sequence || null
		});

		return res.status(201).json(result);
	} catch (error) {
		logError(`Error adding test to suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to add test to suite' });
	}
}) as any);

/**
 * DELETE /api/test-suites/:id/tests/:testId
 * Remove a test from a suite
 */
router.delete('/:id/tests/:testId', (async (req: Request<{ id: string, testId: string }>, res: Response) => {
	try {
		const suiteId = parseIdParam(res, req.params.id, 'Invalid suite ID or test ID');
		const conversationId = parseIdParam(res, req.params.testId, 'Invalid suite ID or test ID'); // testId maps to conversation_id
		if (suiteId === null || conversationId === null) {
			return;
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(suiteId);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		// Find and delete the suite entry for this conversation
		const entries = getEntriesInSuite(suiteId);
		const entryToDelete = entries.find(entry => entry.conversation_id === conversationId);

		if (!entryToDelete) {
			return res.status(404).json({ error: 'Test not found in suite' });
		}

		deleteSuiteEntry(entryToDelete.id);
		return res.status(204).send();
	} catch (error) {
		logError(`Error removing test ${req.params.testId} from suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to remove test from suite' });
	}
}) as any);

/**
 * PUT /api/test-suites/:id/tests/reorder
 * Reorder tests within a suite
 */
router.put('/:id/tests/reorder', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (suiteId === null) {
			return;
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

		// Map test_id to conversation_id and find corresponding suite entries
		const entries = getEntriesInSuite(suiteId);
		const entryOrders = test_orders.map(order => {
			const conversationId = order.test_id; // test_id maps to conversation_id
			const entry = entries.find(e => e.conversation_id === conversationId);

			if (!entry) {
				throw new Error(`Test ${conversationId} not found in suite ${suiteId}`);
			}

			return {
				entry_id: entry.id,
				sequence: order.sequence
			};
		});

		reorderSuiteEntries(suiteId, entryOrders);
		return res.status(200).json({ success: true });
	} catch (error) {
		logError(`Error reordering tests in suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to reorder tests in suite' });
	}
}) as any);

/**
 * GET /api/test-suites/:id/entries
 * Get all entries in a suite
 */
router.get('/:id/entries', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (suiteId === null) {
			return;
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(suiteId);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		const entries = getEntriesInSuite(suiteId);
		return res.json(entries);
	} catch (error) {
		logError(`Error fetching entries for suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to fetch entries for suite' });
	}
}) as any);

/**
 * POST /api/test-suites/:id/entries
 * Add an entry to a suite
 */
router.post('/:id/entries', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (suiteId === null) {
			return;
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
			test_id: test_id ? Number(test_id) : undefined,
			child_suite_id: child_suite_id ? Number(child_suite_id) : undefined,
			agent_id_override: agent_id_override ? Number(agent_id_override) : undefined
		});

		return res.status(201).json(entry);
	} catch (error) {
		logError(`Error adding entry to suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to add entry to suite' });
	}
}) as any);

/**
 * PUT /api/test-suites/:id/entries/:entryId
 * Update a suite entry
 */
router.put('/:id/entries/:entryId', (async (req: Request<{ id: string, entryId: string }>, res: Response) => {
	try {
		const entryId = parseIdParam(res, req.params.entryId, 'Invalid entry ID');
		if (entryId === null) {
			return;
		}

		const { sequence, agent_id_override } = req.body;

		updateSuiteEntryOrder(entryId, sequence, agent_id_override);
		return res.json({ message: 'Entry updated successfully' });
	} catch (error) {
		logError(`Error updating entry ${req.params.entryId}:`, error);
		return res.status(500).json({ error: 'Failed to update entry' });
	}
}) as any);

/**
 * DELETE /api/test-suites/:id/entries/:entryId
 * Delete a suite entry
 */
router.delete('/:id/entries/:entryId', (async (req: Request<{ id: string, entryId: string }>, res: Response) => {
	try {
		const entryId = parseIdParam(res, req.params.entryId, 'Invalid entry ID');
		if (entryId === null) {
			return;
		}

		deleteSuiteEntry(entryId);
		return res.status(204).send();
	} catch (error) {
		logError(`Error deleting entry ${req.params.entryId}:`, error);
		return res.status(500).json({ error: 'Failed to delete entry' });
	}
}) as any);

/**
 * PUT /api/test-suites/:id/entries/reorder
 * Reorder entries in a suite
 */
router.put('/:id/entries/reorder', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const suiteId = parseIdParam(res, req.params.id, 'Invalid test suite ID');
		if (suiteId === null) {
			return;
		}

		const { entry_orders } = req.body;
		if (!Array.isArray(entry_orders)) {
			return res.status(400).json({ error: 'entry_orders must be an array' });
		}

		// Validate entry_orders format
		for (const order of entry_orders) {
			if (!order.entry_id || !order.sequence || Number.isNaN(Number(order.entry_id)) || Number.isNaN(Number(order.sequence))) {
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
		logError(`Error reordering entries in suite ${req.params.id}:`, error);
		return res.status(500).json({ error: 'Failed to reorder entries' });
	}
}) as any);

export default router;
