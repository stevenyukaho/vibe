import { Router } from 'express';
import type { Request, Response } from 'express';
import { createAgent, getAgents, getAgentById, updateAgent, deleteAgent, getAgentsWithCount } from '../db/queries';
import type { Agent } from '../types';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';

const router = Router();

// Get all agents
router.get('/', (async (req: Request, res: Response) => {
	try {
		if (hasPaginationParams(req)) {
			const queryParams = validatePaginationOrError(req, res);
			if (!queryParams) {
				return;
			}

			const { data, total } = getAgentsWithCount(queryParams);

			return res.json({
				data,
				total,
				limit: queryParams.limit,
				offset: queryParams.offset
			});
		}

		const agents = await getAgents();
		return res.json(agents);
	} catch (error) {
		console.error('Error fetching agents:', error);
		return res.status(500).json({ error: 'Failed to fetch agents' });
	}
}) as any);

// Get agent by ID
router.get<{ id: string }>('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const agent = await getAgentById(Number(req.params.id));
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}
		return res.json(agent);
	} catch (error) {
		console.error('Error fetching agent:', error);
		return res.status(500).json({ error: 'Failed to fetch agent' });
	}
}) as any);

// Create new agent
router.post<{}, {}, Omit<Agent, 'id' | 'created_at'>>('/', (async (req: Request<{}, {}, Omit<Agent, 'id' | 'created_at'>>, res: Response) => {
	try {
		const { name, version, prompt, settings } = req.body;

		// Validate required fields
		if (!name || !version || !prompt || !settings) {
			return res.status(400).json({
				error: 'Failed to create agent',
				details: 'Name, version, prompt, and settings are required fields'
			});
		}

		// Validate settings is valid JSON
		try {
			if (typeof settings === 'string') {
				JSON.parse(settings);
			}
		} catch (e) {
			return res.status(400).json({
				error: 'Failed to create agent',
				details: 'Settings must be valid JSON'
			});
		}

		const agent = await createAgent(req.body);
		return res.status(201).json(agent);
	} catch (error) {
		console.error('Error creating agent:', error);
		return res.status(500).json({
			error: 'Failed to create agent',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

// Update existing agent
router.put<{ id: string }, {}, Partial<Agent>>('/:id', (async (req: Request<{ id: string }, {}, Partial<Agent>>, res: Response) => {
	try {
		const id = Number(req.params.id);

		// Check if agent exists
		const existingAgent = await getAgentById(id);
		if (!existingAgent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		// Validate settings is valid JSON if provided
		if (req.body.settings) {
			try {
				if (typeof req.body.settings === 'string') {
					JSON.parse(req.body.settings);
				}
			} catch (e) {
				return res.status(400).json({
					error: 'Failed to update agent',
					details: 'Settings must be valid JSON'
				});
			}
		}

		const updatedAgent = await updateAgent(id, req.body);
		return res.json(updatedAgent);
	} catch (error) {
		console.error('Error updating agent:', error);
		return res.status(500).json({
			error: 'Failed to update agent',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

// Delete agent
router.delete<{ id: string }>('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = Number(req.params.id);

		// Check if agent exists
		const existingAgent = await getAgentById(id);
		if (!existingAgent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		await deleteAgent(id);
		return res.status(204).send();
	} catch (error) {
		console.error('Error deleting agent:', error);
		return res.status(500).json({
			error: 'Failed to delete agent',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

export default router; 