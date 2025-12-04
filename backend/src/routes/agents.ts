import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	createAgent,
	getAgents,
	getAgentById,
	updateAgent,
	deleteAgent,
	getAgentsWithCount,
	listAgentRequestTemplates,
	getAgentRequestTemplateById,
	createAgentRequestTemplate,
	updateAgentRequestTemplate,
	deleteAgentRequestTemplate,
	setDefaultAgentRequestTemplate,
	listAgentResponseMaps,
	getAgentResponseMapById,
	createAgentResponseMap,
	updateAgentResponseMap,
	deleteAgentResponseMap,
	setDefaultAgentResponseMap
} from '../db/queries';
import type { Agent, AgentRequestTemplate, AgentResponseMap } from '@ibm-vibe/types';
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

// Request templates
router.get<{ id: string }>('/:id/request-templates', ((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		return res.json(listAgentRequestTemplates(agentId));
	} catch (error) {
		console.error('Error listing request templates:', error);
		return res.status(500).json({ error: 'Failed to list request templates' });
	}
}) as any);

router.post<{ id: string }, {}, Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>('/:id/request-templates', ((req: Request<{ id: string }, {}, Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const created = createAgentRequestTemplate(agentId, req.body);

		return res.status(201).json(created);
	} catch (error) {
		console.error('Error creating request template:', error);
		return res.status(500).json({ error: 'Failed to create request template' });
	}
}) as any);

router.patch<{ id: string; templateId: string }, {}, Partial<Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>>('/:id/request-templates/:templateId', ((req: Request<{ id: string; templateId: string }, {}, Partial<Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>>, res: Response) => {
	try {
		const tplId = Number(req.params.templateId);
		const existing = getAgentRequestTemplateById(tplId);
		if (!existing) {
			return res.status(404).json({ error: 'Template not found' });
		}
		const updated = updateAgentRequestTemplate(tplId, req.body);

		return res.json(updated);
	} catch (error) {
		console.error('Error updating request template:', error);
		return res.status(500).json({ error: 'Failed to update request template' });
	}
}) as any);

router.delete<{ id: string; templateId: string }>('/:id/request-templates/:templateId', ((req: Request<{ id: string; templateId: string }>, res: Response) => {
	try {
		const tplId = Number(req.params.templateId);
		const existing = getAgentRequestTemplateById(tplId);
		if (!existing) {
			return res.status(404).json({ error: 'Template not found' });
		}
		deleteAgentRequestTemplate(tplId);

		return res.status(204).send();
	} catch (error) {
		console.error('Error deleting request template:', error);
		return res.status(500).json({ error: 'Failed to delete request template' });
	}
}) as any);

router.post<{ id: string; templateId: string }>('/:id/request-templates/:templateId/default', ((req: Request<{ id: string; templateId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const tplId = Number(req.params.templateId);
		const existing = getAgentRequestTemplateById(tplId);
		if (!existing || existing.agent_id !== agentId) {
			return res.status(404).json({ error: 'Template not found' });
		}
		setDefaultAgentRequestTemplate(agentId, tplId);

		return res.status(204).send();
	} catch (error) {
		console.error('Error setting default request template:', error);
		return res.status(500).json({ error: 'Failed to set default request template' });
	}
}) as any);

// Response maps
router.get<{ id: string }>('/:id/response-maps', ((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		return res.json(listAgentResponseMaps(agentId));
	} catch (error) {
		console.error('Error listing response maps:', error);
		return res.status(500).json({ error: 'Failed to list response maps' });
	}
}) as any);

router.post<{ id: string }, {}, Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>('/:id/response-maps', ((req: Request<{ id: string }, {}, Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const created = createAgentResponseMap(agentId, req.body);

		return res.status(201).json(created);
	} catch (error) {
		console.error('Error creating response map:', error);
		return res.status(500).json({ error: 'Failed to create response map' });
	}
}) as any);

router.patch<{ id: string; mapId: string }, {}, Partial<Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>>('/:id/response-maps/:mapId', ((req: Request<{ id: string; mapId: string }, {}, Partial<Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>>, res: Response) => {
	try {
		const mapId = Number(req.params.mapId);
		const existing = getAgentResponseMapById(mapId);
		if (!existing) {
			return res.status(404).json({ error: 'Response map not found' });
		}
		const updated = updateAgentResponseMap(mapId, req.body);

		return res.json(updated);
	} catch (error) {
		console.error('Error updating response map:', error);
		return res.status(500).json({ error: 'Failed to update response map' });
	}
}) as any);

router.delete<{ id: string; mapId: string }>('/:id/response-maps/:mapId', ((req: Request<{ id: string; mapId: string }>, res: Response) => {
	try {
		const mapId = Number(req.params.mapId);
		const existing = getAgentResponseMapById(mapId);
		if (!existing) {
			return res.status(404).json({ error: 'Response map not found' });
		}
		deleteAgentResponseMap(mapId);

		return res.status(204).send();
	} catch (error) {
		console.error('Error deleting response map:', error);
		return res.status(500).json({ error: 'Failed to delete response map' });
	}
}) as any);

router.post<{ id: string; mapId: string }>('/:id/response-maps/:mapId/default', ((req: Request<{ id: string; mapId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const mapId = Number(req.params.mapId);
		const existing = getAgentResponseMapById(mapId);
		if (!existing || existing.agent_id !== agentId) {
			return res.status(404).json({ error: 'Response map not found' });
		}
		setDefaultAgentResponseMap(agentId, mapId);

		return res.status(204).send();
	} catch (error) {
		console.error('Error setting default response map:', error);
		return res.status(500).json({ error: 'Failed to set default response map' });
	}
}) as any);
