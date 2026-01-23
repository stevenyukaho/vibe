/**
 * Routes for global request templates.
 *
 * These templates are global resources that can be linked to multiple agents.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import * as templateRepo from '../db/repositories/templateRepo';

const router = Router();

// =====================
// REQUEST TEMPLATES
// =====================

/**
 * GET /api/templates
 * List all request templates, optionally filtered by capability.
 */
router.get('/', (async (req: Request, res: Response) => {
	try {
		const capability = req.query.capability as string | undefined;
		const templates = templateRepo.listRequestTemplates(capability ? { capability } : undefined);
		return res.json(templates);
	} catch (error) {
		console.error('Error fetching templates:', error);
		return res.status(500).json({ error: 'Failed to fetch templates' });
	}
}) as any);

/**
 * GET /api/templates/capability-names
 * List all distinct capability names from request templates.
 */
router.get('/capability-names', (async (_req: Request, res: Response) => {
	try {
		const names = templateRepo.listRequestTemplateCapabilityNames();
		return res.json(names);
	} catch (error) {
		console.error('Error fetching capability names:', error);
		return res.status(500).json({ error: 'Failed to fetch capability names' });
	}
}) as any);

/**
 * GET /api/templates/:id
 * Get a request template by ID.
 */
router.get('/:id', (async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid template ID' });
		}

		const template = templateRepo.getRequestTemplateById(id);
		if (!template) {
			return res.status(404).json({ error: 'Template not found' });
		}

		return res.json(template);
	} catch (error) {
		console.error('Error fetching template:', error);
		return res.status(500).json({ error: 'Failed to fetch template' });
	}
}) as any);

/**
 * POST /api/templates
 * Create a new request template.
 */
router.post('/', (async (req: Request, res: Response) => {
	try {
		const { name, description, capability, body } = req.body;

		if (!name || !body) {
			return res.status(400).json({
				error: 'Name and body are required fields'
			});
		}

		const template = templateRepo.createRequestTemplate({
			name,
			description,
			capability,
			body
		});

		return res.status(201).json(template);
	} catch (error: any) {
		console.error('Error creating template:', error);

		if (error.message?.includes('UNIQUE constraint failed')) {
			return res.status(409).json({
				error: 'A template with this name already exists'
			});
		}

		return res.status(500).json({ error: 'Failed to create template' });
	}
}) as any);

/**
 * PUT /api/templates/:id
 * Update a request template.
 */
router.put('/:id', (async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid template ID' });
		}

		const { name, description, capability, body } = req.body;
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
		if (body !== undefined) {
			updates.body = body;
		}

		const template = templateRepo.updateRequestTemplate(id, updates);
		if (!template) {
			return res.status(404).json({ error: 'Template not found' });
		}

		return res.json(template);
	} catch (error: any) {
		console.error('Error updating template:', error);

		if (error.message?.includes('UNIQUE constraint failed')) {
			return res.status(409).json({
				error: 'A template with this name already exists'
			});
		}

		return res.status(500).json({ error: 'Failed to update template' });
	}
}) as any);

/**
 * DELETE /api/templates/:id
 * Delete a request template.
 */
router.delete('/:id', (async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid template ID' });
		}

		const existing = templateRepo.getRequestTemplateById(id);
		if (!existing) {
			return res.status(404).json({ error: 'Template not found' });
		}

		templateRepo.deleteRequestTemplate(id);
		return res.status(204).send();
	} catch (error) {
		console.error('Error deleting template:', error);
		return res.status(500).json({ error: 'Failed to delete template' });
	}
}) as any);

export default router;
