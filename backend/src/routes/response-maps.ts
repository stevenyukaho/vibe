/**
 * Routes for global response maps.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import * as templateRepo from '../db/repositories/templateRepo';
import { shouldLog } from '../lib/logger';

const router = Router();

/**
 * GET /api/response-maps
 * List all response maps, optionally filtered by capability.
 */
router.get('/', (async (req: Request, res: Response) => {
	try {
		const capability = req.query.capability as string | undefined;
		const maps = templateRepo.listResponseMaps(capability ? { capability } : undefined);
		return res.json(maps);
	} catch (error) {
		/* istanbul ignore next */
		if (shouldLog) {
			console.error('Error fetching response maps:', error);
		}
		return res.status(500).json({ error: 'Failed to fetch response maps' });
	}
}) as any);

/**
 * GET /api/response-maps/capability-names
 * List all distinct capability names from response maps.
 */
router.get('/capability-names', (async (_req: Request, res: Response) => {
	try {
		const names = templateRepo.listResponseMapCapabilityNames();
		return res.json(names);
	} catch (error) {
		/* istanbul ignore next */
		if (shouldLog) {
			console.error('Error fetching capability names:', error);
		}
		return res.status(500).json({ error: 'Failed to fetch capability names' });
	}
}) as any);

/**
 * GET /api/response-maps/:id
 * Get a response map by ID.
 */
router.get('/:id', (async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid response map ID' });
		}

		const map = templateRepo.getResponseMapById(id);
		if (!map) {
			return res.status(404).json({ error: 'Response map not found' });
		}

		return res.json(map);
	} catch (error) {
		/* istanbul ignore next */
		if (shouldLog) {
			console.error('Error fetching response map:', error);
		}
		return res.status(500).json({ error: 'Failed to fetch response map' });
	}
}) as any);

/**
 * POST /api/response-maps
 * Create a new response map.
 */
router.post('/', (async (req: Request, res: Response) => {
	try {
		const { name, description, capability, spec } = req.body;

		if (!name || !spec) {
			return res.status(400).json({
				error: 'Name and spec are required fields'
			});
		}

		const map = templateRepo.createResponseMap({
			name,
			description,
			capability,
			spec
		});

		return res.status(201).json(map);
	} catch (error: any) {
		/* istanbul ignore next */
		if (shouldLog) {
			console.error('Error creating response map:', error);
		}

		if (error.message?.includes('UNIQUE constraint failed')) {
			return res.status(409).json({
				error: 'A response map with this name already exists'
			});
		}

		return res.status(500).json({ error: 'Failed to create response map' });
	}
}) as any);

/**
 * PUT /api/response-maps/:id
 * Update a response map.
 */
router.put('/:id', (async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid response map ID' });
		}

		const { name, description, capability, spec } = req.body;
		const updates: any = {};

		if (name !== undefined) {
			updates.name = name;
		}
		if (description !== undefined) {
			updates.description = description;
		}
		if (capability !== undefined) {
			updates.capability = capability;
		}
		if (spec !== undefined) {
			updates.spec = spec;
		}

		const map = templateRepo.updateResponseMap(id, updates);
		if (!map) {
			return res.status(404).json({ error: 'Response map not found' });
		}

		return res.json(map);
	} catch (error: any) {
		/* istanbul ignore next */
		if (shouldLog) {
			console.error('Error updating response map:', error);
		}

		if (error.message?.includes('UNIQUE constraint failed')) {
			return res.status(409).json({
				error: 'A response map with this name already exists'
			});
		}

		return res.status(500).json({ error: 'Failed to update response map' });
	}
}) as any);

/**
 * DELETE /api/response-maps/:id
 * Delete a response map.
 */
router.delete('/:id', (async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid response map ID' });
		}

		const existing = templateRepo.getResponseMapById(id);
		if (!existing) {
			return res.status(404).json({ error: 'Response map not found' });
		}

		templateRepo.deleteResponseMap(id);
		return res.status(204).send();
	} catch (error) {
		/* istanbul ignore next */
		if (shouldLog) {
			console.error('Error deleting response map:', error);
		}
		return res.status(500).json({ error: 'Failed to delete response map' });
	}
}) as any);

export default router;
