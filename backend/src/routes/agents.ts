import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	createAgent,
	getAgents,
	getAgentById,
	updateAgent,
	deleteAgent,
	getAgentsWithCount
} from '../db/queries';
import * as templateRepo from '../db/repositories/templateRepo';
import type { Agent, AgentRequestTemplate, AgentResponseMap } from '@ibm-vibe/types';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';
import { serializeCapabilities } from '../lib/communicationCapabilities';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();
const shouldLog = process.env.NODE_ENV !== 'test';
const logError = (...args: unknown[]) => {
	/* istanbul ignore next */
	if (shouldLog) console.error(...args);
};

const getCapabilityUpdate = (payload: Record<string, unknown>): string | null | undefined => {
	if (Object.prototype.hasOwnProperty.call(payload, 'capabilities')) {
		return serializeCapabilities(payload.capabilities);
	}
	if (Object.prototype.hasOwnProperty.call(payload, 'capability')) {
		return serializeCapabilities(payload.capability);
	}
	return undefined;
};

const toLegacyRequestTemplate = (
	agentId: number,
	template: templateRepo.RequestTemplate & { is_default?: number | boolean },
	isDefaultOverride?: number | boolean
): AgentRequestTemplate => ({
	id: template.id,
	agent_id: agentId,
	name: template.name,
	description: template.description ?? null,
	engine: null,
	content_type: null,
	body: template.body,
	tags: null,
	is_default: isDefaultOverride ?? template.is_default ?? 0,
	capabilities: template.capability ?? null,
	created_at: template.created_at
} as unknown as AgentRequestTemplate);

const toLegacyResponseMap = (
	agentId: number,
	map: templateRepo.ResponseMap & { is_default?: number | boolean },
	isDefaultOverride?: number | boolean
): AgentResponseMap => ({
	id: map.id,
	agent_id: agentId,
	name: map.name,
	description: map.description ?? null,
	spec: map.spec,
	tags: null,
	is_default: isDefaultOverride ?? map.is_default ?? 0,
	capabilities: map.capability ?? null,
	created_at: map.created_at
} as unknown as AgentResponseMap);

// Get all agents
router.get('/', asyncHandler(async (req: Request, res: Response) => {
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
		logError('Error fetching agents:', error);
		return res.status(500).json({ error: 'Failed to fetch agents' });
	}
}));

// Get agent by ID
router.get<{ id: string }>('/:id', asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
	try {
		const agent = await getAgentById(Number(req.params.id));
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}
		return res.json(agent);
	} catch (error) {
		logError('Error fetching agent:', error);
		return res.status(500).json({ error: 'Failed to fetch agent' });
	}
}));

// Create new agent
router.post<Record<string, never>, unknown, Omit<Agent, 'id' | 'created_at'>>('/', asyncHandler(async (req: Request<Record<string, never>, unknown, Omit<Agent, 'id' | 'created_at'>>, res: Response) => {
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
		} catch {
			return res.status(400).json({
				error: 'Failed to create agent',
				details: 'Settings must be valid JSON'
			});
		}

		const agent = await createAgent(req.body);
		return res.status(201).json(agent);
	} catch (error) {
		logError('Error creating agent:', error);
		return res.status(500).json({
			error: 'Failed to create agent',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}));

// Update existing agent
router.put<{ id: string }, unknown, Partial<Agent>>('/:id', asyncHandler(async (req: Request<{ id: string }, unknown, Partial<Agent>>, res: Response) => {
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
			} catch {
				return res.status(400).json({
					error: 'Failed to update agent',
					details: 'Settings must be valid JSON'
				});
			}
		}

		const updatedAgent = await updateAgent(id, req.body);
		return res.json(updatedAgent);
	} catch (error) {
		logError('Error updating agent:', error);
		return res.status(500).json({
			error: 'Failed to update agent',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}));

// Delete agent
router.delete<{ id: string }>('/:id', asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
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
		logError('Error deleting agent:', error);
		return res.status(500).json({
			error: 'Failed to delete agent',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}));

// Capability names - for auto-complete in UI
router.get('/capability-names/request-templates', asyncHandler((_req: Request, res: Response) => {
	try {
		const names = templateRepo.listRequestTemplateCapabilityNames();
		return res.json(names);
	} catch (error) {
		logError('Error listing request template capability names:', error);
		return res.status(500).json({ error: 'Failed to list capability names' });
	}
}));

router.get('/capability-names/response-maps', asyncHandler((_req: Request, res: Response) => {
	try {
		const names = templateRepo.listResponseMapCapabilityNames();
		return res.json(names);
	} catch (error) {
		logError('Error listing response map capability names:', error);
		return res.status(500).json({ error: 'Failed to list capability names' });
	}
}));

// Request templates
router.get<{ id: string }>('/:id/request-templates', asyncHandler((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const templates = templateRepo.getAgentTemplates(agentId);
		return res.json(templates.map(template => toLegacyRequestTemplate(agentId, template, template.is_default)));
	} catch (error) {
		logError('Error listing request templates:', error);
		return res.status(500).json({ error: 'Failed to list request templates' });
	}
}));

router.post<{ id: string }, unknown, Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>('/:id/request-templates', asyncHandler((req: Request<{ id: string }, unknown, Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		const { template_id, is_default, ...templateData } = req.body as Record<string, unknown> & { template_id?: number };
		let templateToLink: templateRepo.RequestTemplate;

		if (template_id) {
			const existing = templateRepo.getRequestTemplateById(Number(template_id));
			if (!existing) {
				return res.status(404).json({ error: 'Template not found' });
			}
			templateToLink = existing;
		} else {
			if (!templateData.name || !templateData.body) {
				return res.status(400).json({ error: 'Name and body are required for new templates' });
			}
			const capability = getCapabilityUpdate(templateData);
			const uniqueName = templateRepo.getUniqueRequestTemplateName(String(templateData.name), agent.name);
			templateToLink = templateRepo.createRequestTemplate({
				name: uniqueName,
				description: (templateData.description as string | undefined),
				capability: capability ?? undefined,
				body: String(templateData.body)
			});
		}

		templateRepo.linkTemplateToAgent(agentId, templateToLink.id!, Boolean(is_default));
		const link = templateRepo.getAgentTemplateLink(agentId, templateToLink.id!);
		const response = toLegacyRequestTemplate(agentId, templateToLink, link?.is_default);

		return res.status(201).json(response);
	} catch (error) {
		logError('Error creating request template:', error);
		return res.status(500).json({ error: 'Failed to create request template' });
	}
}));

router.patch<{ id: string; templateId: string }, unknown, Partial<Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>>('/:id/request-templates/:templateId', asyncHandler((req: Request<{ id: string; templateId: string }, unknown, Partial<Omit<AgentRequestTemplate, 'id' | 'agent_id' | 'created_at'>>>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const tplId = Number(req.params.templateId);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		const link = templateRepo.getAgentTemplateLink(agentId, tplId);
		if (!link) {
			return res.status(404).json({ error: 'Template not found' });
		}
		const existing = templateRepo.getRequestTemplateById(tplId);
		if (!existing) {
			return res.status(404).json({ error: 'Template not found' });
		}

		const capabilityUpdate = getCapabilityUpdate(req.body as Record<string, unknown>);
		const updates: Partial<templateRepo.RequestTemplate> = {};
		if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
			updates.name = (req.body as any).name;
		}
		if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
			updates.description = (req.body as any).description;
		}
		if (Object.prototype.hasOwnProperty.call(req.body, 'body')) {
			updates.body = (req.body as any).body;
		}
		if (capabilityUpdate !== undefined) {
			updates.capability = capabilityUpdate ?? undefined;
		}

		const wantsDefault = Boolean((req.body as any).is_default);
		const hasContentUpdates = Object.keys(updates).length > 0;
		const linkCount = templateRepo.getTemplateLinkCount(tplId);

		if (hasContentUpdates && linkCount > 1) {
			const baseName = updates.name ?? existing.name;
			const uniqueName = templateRepo.getUniqueRequestTemplateName(baseName, agent.name);
			const created = templateRepo.createRequestTemplate({
				name: uniqueName,
				description: updates.description ?? existing.description ?? undefined,
				capability: updates.capability ?? existing.capability ?? undefined,
				body: updates.body ?? existing.body
			});

			const shouldDefault = wantsDefault || Boolean(link.is_default);
			templateRepo.linkTemplateToAgent(agentId, created.id!, shouldDefault);
			const newLink = templateRepo.getAgentTemplateLink(agentId, created.id!);
			return res.json(toLegacyRequestTemplate(agentId, created, newLink?.is_default ?? (shouldDefault ? 1 : 0)));
		}

		const updated = templateRepo.updateRequestTemplate(tplId, updates);
		if (!updated) {
			return res.status(404).json({ error: 'Template not found' });
		}
		if (wantsDefault) {
			templateRepo.setAgentDefaultTemplate(agentId, tplId);
		}
		const updatedLink = templateRepo.getAgentTemplateLink(agentId, tplId);
		return res.json(toLegacyRequestTemplate(agentId, updated, updatedLink?.is_default));
	} catch (error) {
		logError('Error updating request template:', error);
		return res.status(500).json({ error: 'Failed to update request template' });
	}
}));

router.delete<{ id: string; templateId: string }>('/:id/request-templates/:templateId', asyncHandler((req: Request<{ id: string; templateId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const tplId = Number(req.params.templateId);
		const link = templateRepo.getAgentTemplateLink(agentId, tplId);
		if (!link) {
			return res.status(404).json({ error: 'Template not found' });
		}
		templateRepo.unlinkTemplateFromAgent(agentId, tplId);

		return res.status(204).send();
	} catch (error) {
		logError('Error deleting request template:', error);
		return res.status(500).json({ error: 'Failed to delete request template' });
	}
}));

router.post<{ id: string; templateId: string }>('/:id/request-templates/:templateId/default', asyncHandler((req: Request<{ id: string; templateId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const tplId = Number(req.params.templateId);
		const link = templateRepo.getAgentTemplateLink(agentId, tplId);
		if (!link) {
			return res.status(404).json({ error: 'Template not found' });
		}
		templateRepo.setAgentDefaultTemplate(agentId, tplId);

		return res.status(204).send();
	} catch (error) {
		logError('Error setting default request template:', error);
		return res.status(500).json({ error: 'Failed to set default request template' });
	}
}));

// Response maps
router.get<{ id: string }>('/:id/response-maps', asyncHandler((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const maps = templateRepo.getAgentResponseMaps(agentId);
		return res.json(maps.map(map => toLegacyResponseMap(agentId, map, map.is_default)));
	} catch (error) {
		logError('Error listing response maps:', error);
		return res.status(500).json({ error: 'Failed to list response maps' });
	}
}));

router.post<{ id: string }, unknown, Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>('/:id/response-maps', asyncHandler((req: Request<{ id: string }, unknown, Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		const { response_map_id, is_default, ...mapData } = req.body as Record<string, unknown> & { response_map_id?: number };
		let mapToLink: templateRepo.ResponseMap;

		if (response_map_id) {
			const existing = templateRepo.getResponseMapById(Number(response_map_id));
			if (!existing) {
				return res.status(404).json({ error: 'Response map not found' });
			}
			mapToLink = existing;
		} else {
			if (!mapData.name || !mapData.spec) {
				return res.status(400).json({ error: 'Name and spec are required for new response maps' });
			}
			const capability = getCapabilityUpdate(mapData);
			const uniqueName = templateRepo.getUniqueResponseMapName(String(mapData.name), agent.name);
			mapToLink = templateRepo.createResponseMap({
				name: uniqueName,
				description: (mapData.description as string | undefined),
				capability: capability ?? undefined,
				spec: String(mapData.spec)
			});
		}

		templateRepo.linkResponseMapToAgent(agentId, mapToLink.id!, Boolean(is_default));
		const link = templateRepo.getAgentResponseMapLink(agentId, mapToLink.id!);
		const response = toLegacyResponseMap(agentId, mapToLink, link?.is_default);

		return res.status(201).json(response);
	} catch (error) {
		logError('Error creating response map:', error);
		return res.status(500).json({ error: 'Failed to create response map' });
	}
}));

router.patch<{ id: string; mapId: string }, unknown, Partial<Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>>('/:id/response-maps/:mapId', asyncHandler((req: Request<{ id: string; mapId: string }, unknown, Partial<Omit<AgentResponseMap, 'id' | 'agent_id' | 'created_at'>>>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const mapId = Number(req.params.mapId);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		const link = templateRepo.getAgentResponseMapLink(agentId, mapId);
		if (!link) {
			return res.status(404).json({ error: 'Response map not found' });
		}
		const existing = templateRepo.getResponseMapById(mapId);
		if (!existing) {
			return res.status(404).json({ error: 'Response map not found' });
		}

		const capabilityUpdate = getCapabilityUpdate(req.body as Record<string, unknown>);
		const updates: Partial<templateRepo.ResponseMap> = {};
		if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
			updates.name = (req.body as any).name;
		}
		if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
			updates.description = (req.body as any).description;
		}
		if (Object.prototype.hasOwnProperty.call(req.body, 'spec')) {
			updates.spec = (req.body as any).spec;
		}
		if (capabilityUpdate !== undefined) {
			updates.capability = capabilityUpdate ?? undefined;
		}

		const wantsDefault = Boolean((req.body as any).is_default);
		const hasContentUpdates = Object.keys(updates).length > 0;
		const linkCount = templateRepo.getResponseMapLinkCount(mapId);

		if (hasContentUpdates && linkCount > 1) {
			const baseName = updates.name ?? existing.name;
			const uniqueName = templateRepo.getUniqueResponseMapName(baseName, agent.name);
			const created = templateRepo.createResponseMap({
				name: uniqueName,
				description: updates.description ?? existing.description ?? undefined,
				capability: updates.capability ?? existing.capability ?? undefined,
				spec: updates.spec ?? existing.spec
			});

			const shouldDefault = wantsDefault || Boolean(link.is_default);
			templateRepo.linkResponseMapToAgent(agentId, created.id!, shouldDefault);
			const newLink = templateRepo.getAgentResponseMapLink(agentId, created.id!);
			return res.json(toLegacyResponseMap(agentId, created, newLink?.is_default ?? (shouldDefault ? 1 : 0)));
		}

		const updated = templateRepo.updateResponseMap(mapId, updates);
		if (!updated) {
			return res.status(404).json({ error: 'Response map not found' });
		}
		if (wantsDefault) {
			templateRepo.setAgentDefaultResponseMap(agentId, mapId);
		}
		const updatedLink = templateRepo.getAgentResponseMapLink(agentId, mapId);
		return res.json(toLegacyResponseMap(agentId, updated, updatedLink?.is_default));
	} catch (error) {
		logError('Error updating response map:', error);
		return res.status(500).json({ error: 'Failed to update response map' });
	}
}));

router.delete<{ id: string; mapId: string }>('/:id/response-maps/:mapId', asyncHandler((req: Request<{ id: string; mapId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const mapId = Number(req.params.mapId);
		const link = templateRepo.getAgentResponseMapLink(agentId, mapId);
		if (!link) {
			return res.status(404).json({ error: 'Response map not found' });
		}
		templateRepo.unlinkResponseMapFromAgent(agentId, mapId);

		return res.status(204).send();
	} catch (error) {
		logError('Error deleting response map:', error);
		return res.status(500).json({ error: 'Failed to delete response map' });
	}
}));

router.post<{ id: string; mapId: string }>('/:id/response-maps/:mapId/default', asyncHandler((req: Request<{ id: string; mapId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const mapId = Number(req.params.mapId);
		const link = templateRepo.getAgentResponseMapLink(agentId, mapId);
		if (!link) {
			return res.status(404).json({ error: 'Response map not found' });
		}
		templateRepo.setAgentDefaultResponseMap(agentId, mapId);

		return res.status(204).send();
	} catch (error) {
		logError('Error setting default response map:', error);
		return res.status(500).json({ error: 'Failed to set default response map' });
	}
}));

// =====================
// GLOBAL TEMPLATE LINKING
// These routes work with the new global template library
// =====================

/**
 * GET /:id/linked-templates
 * Get all global templates linked to this agent.
 */
router.get<{ id: string }>('/:id/linked-templates', asyncHandler((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}
		return res.json(templateRepo.getAgentTemplates(agentId));
	} catch (error) {
		logError('Error listing linked templates:', error);
		return res.status(500).json({ error: 'Failed to list linked templates' });
	}
}));

/**
 * POST /:id/linked-templates
 * Link an existing global template to this agent, or create a new one and link it.
 * Body: { template_id: number } to link existing, or { name, body, ... } to create new
 */
router.post<{ id: string }>('/:id/linked-templates', asyncHandler((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		const { template_id, is_default, ...templateData } = req.body;

		let templateToLink: templateRepo.RequestTemplate;

		if (template_id) {
			// Link existing template
			const existing = templateRepo.getRequestTemplateById(template_id);
			if (!existing) {
				return res.status(404).json({ error: 'Template not found' });
			}
			templateToLink = existing;
		} else {
			// Create new global template
			if (!templateData.name || !templateData.body) {
				return res.status(400).json({ error: 'Name and body are required for new templates' });
			}
			templateToLink = templateRepo.createRequestTemplate(templateData);
		}

		templateRepo.linkTemplateToAgent(agentId, templateToLink.id!, is_default);

		return res.status(201).json(templateToLink);
	} catch (error: any) {
		logError('Error linking template:', error);
		if (error.message?.includes('UNIQUE constraint failed')) {
			return res.status(409).json({ error: 'A template with this name already exists' });
		}
		return res.status(500).json({ error: 'Failed to link template' });
	}
}));

/**
 * DELETE /:id/linked-templates/:templateId
 * Unlink a global template from this agent (does not delete the template).
 */
router.delete<{ id: string; templateId: string }>('/:id/linked-templates/:templateId', asyncHandler((req: Request<{ id: string; templateId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const templateId = Number(req.params.templateId);

		templateRepo.unlinkTemplateFromAgent(agentId, templateId);
		return res.status(204).send();
	} catch (error) {
		logError('Error unlinking template:', error);
		return res.status(500).json({ error: 'Failed to unlink template' });
	}
}));

/**
 * POST /:id/linked-templates/:templateId/default
 * Set a linked template as the default for this agent.
 */
router.post<{ id: string; templateId: string }>('/:id/linked-templates/:templateId/default', asyncHandler((req: Request<{ id: string; templateId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const templateId = Number(req.params.templateId);

		templateRepo.setAgentDefaultTemplate(agentId, templateId);
		return res.status(204).send();
	} catch (error) {
		logError('Error setting default template:', error);
		return res.status(500).json({ error: 'Failed to set default template' });
	}
}));

/**
 * GET /:id/linked-response-maps
 * Get all global response maps linked to this agent.
 */
router.get<{ id: string }>('/:id/linked-response-maps', asyncHandler((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}
		return res.json(templateRepo.getAgentResponseMaps(agentId));
	} catch (error) {
		logError('Error listing linked response maps:', error);
		return res.status(500).json({ error: 'Failed to list linked response maps' });
	}
}));

/**
 * POST /:id/linked-response-maps
 * Link an existing global response map to this agent, or create a new one and link it.
 * Body: { response_map_id: number } to link existing, or { name, spec, ... } to create new
 */
router.post<{ id: string }>('/:id/linked-response-maps', asyncHandler((req: Request<{ id: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const agent = getAgentById(agentId);
		if (!agent) {
			return res.status(404).json({ error: 'Agent not found' });
		}

		const { response_map_id, is_default, ...mapData } = req.body;

		let mapToLink: templateRepo.ResponseMap;

		if (response_map_id) {
			// Link existing response map
			const existing = templateRepo.getResponseMapById(response_map_id);
			if (!existing) {
				return res.status(404).json({ error: 'Response map not found' });
			}
			mapToLink = existing;
		} else {
			// Create new global response map
			if (!mapData.name || !mapData.spec) {
				return res.status(400).json({ error: 'Name and spec are required for new response maps' });
			}
			mapToLink = templateRepo.createResponseMap(mapData);
		}

		templateRepo.linkResponseMapToAgent(agentId, mapToLink.id!, is_default);

		return res.status(201).json(mapToLink);
	} catch (error: any) {
		logError('Error linking response map:', error);
		if (error.message?.includes('UNIQUE constraint failed')) {
			return res.status(409).json({ error: 'A response map with this name already exists' });
		}
		return res.status(500).json({ error: 'Failed to link response map' });
	}
}));

/**
 * DELETE /:id/linked-response-maps/:mapId
 * Unlink a global response map from this agent (does not delete the map).
 */
router.delete<{ id: string; mapId: string }>('/:id/linked-response-maps/:mapId', asyncHandler((req: Request<{ id: string; mapId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const mapId = Number(req.params.mapId);

		templateRepo.unlinkResponseMapFromAgent(agentId, mapId);
		return res.status(204).send();
	} catch (error) {
		logError('Error unlinking response map:', error);
		return res.status(500).json({ error: 'Failed to unlink response map' });
	}
}));

/**
 * POST /:id/linked-response-maps/:mapId/default
 * Set a linked response map as the default for this agent.
 */
router.post<{ id: string; mapId: string }>('/:id/linked-response-maps/:mapId/default', asyncHandler((req: Request<{ id: string; mapId: string }>, res: Response) => {
	try {
		const agentId = Number(req.params.id);
		const mapId = Number(req.params.mapId);

		templateRepo.setAgentDefaultResponseMap(agentId, mapId);
		return res.status(204).send();
	} catch (error) {
		logError('Error setting default response map:', error);
		return res.status(500).json({ error: 'Failed to set default response map' });
	}
}));

export default router;
