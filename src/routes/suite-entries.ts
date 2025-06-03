import { Router } from 'express';
import type { Request, Response } from 'express';
import { 
	getTestSuiteById,
	getEntriesInSuite,
	addSuiteEntry,
	updateSuiteEntryOrder,
	deleteSuiteEntry,
	reorderSuiteEntries
} from '../db/queries';

const router = Router();

/**
 * GET /api/suite-entries/:suiteId
 * Get all entries in a suite
 */
router.get('/:suiteId', (async (req: Request<{ suiteId: string }>, res: Response) => {
	try {
		const suiteId = parseInt(req.params.suiteId);
		if (isNaN(suiteId)) {
			return res.status(400).json({ error: 'Invalid test suite ID' });
		}

		// Check if test suite exists
		const existingTestSuite = await getTestSuiteById(suiteId);
		if (!existingTestSuite) {
			return res.status(404).json({ error: 'Test suite not found' });
		}

		const entries = getEntriesInSuite(suiteId);
		res.json(entries);
	} catch (error) {
		console.error(`Error fetching entries for suite ${req.params.suiteId}:`, error);
		res.status(500).json({ error: 'Failed to fetch entries for suite' });
	}
}) as any);

/**
 * POST /api/suite-entries/:suiteId
 * Add an entry to a suite
 */
router.post('/:suiteId', (async (req: Request<{ suiteId: string }>, res: Response) => {
	try {
		const suiteId = parseInt(req.params.suiteId);
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
		
		res.status(201).json(entry);
	} catch (error) {
		console.error(`Error adding entry to suite ${req.params.suiteId}:`, error);
		res.status(500).json({ error: 'Failed to add entry to suite' });
	}
}) as any);

/**
 * PUT /api/suite-entries/:entryId
 * Update a suite entry
 */
router.put('/:entryId', (async (req: Request<{ entryId: string }>, res: Response) => {
	try {
		const entryId = parseInt(req.params.entryId);
		if (isNaN(entryId)) {
			return res.status(400).json({ error: 'Invalid entry ID' });
		}

		const { sequence, agent_id_override } = req.body;
		
		updateSuiteEntryOrder(entryId, sequence, agent_id_override);
		res.json({ message: 'Entry updated successfully' });
	} catch (error) {
		console.error(`Error updating entry ${req.params.entryId}:`, error);
		res.status(500).json({ error: 'Failed to update entry' });
	}
}) as any);

/**
 * DELETE /api/suite-entries/:entryId
 * Delete a suite entry
 */
router.delete('/:entryId', (async (req: Request<{ entryId: string }>, res: Response) => {
	try {
		const entryId = parseInt(req.params.entryId);
		if (isNaN(entryId)) {
			return res.status(400).json({ error: 'Invalid entry ID' });
		}

		deleteSuiteEntry(entryId);
		res.status(204).send();
	} catch (error) {
		console.error(`Error deleting entry ${req.params.entryId}:`, error);
		res.status(500).json({ error: 'Failed to delete entry' });
	}
}) as any);

/**
 * PUT /api/suite-entries/:suiteId/reorder
 * Reorder entries in a suite
 */
router.put('/:suiteId/reorder', (async (req: Request<{ suiteId: string }>, res: Response) => {
	try {
		const suiteId = parseInt(req.params.suiteId);
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
		res.json({ message: 'Entries reordered successfully' });
	} catch (error) {
		console.error(`Error reordering entries in suite ${req.params.suiteId}:`, error);
		res.status(500).json({ error: 'Failed to reorder entries' });
	}
}) as any);

export default router;
