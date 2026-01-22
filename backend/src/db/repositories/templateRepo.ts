/**
 * Repository for global request templates and response maps.
 *
 * Templates are global resources that can be linked to multiple agents.
 * This replaces the agent-scoped templates with a more flexible many-to-many relationship.
 */

import db from '../database';

// Types for global templates (no agent_id)
export interface RequestTemplate {
	id?: number;
	name: string;
	description?: string;
	capability?: string;
	body: string;
	created_at?: string;
}

export interface ResponseMap {
	id?: number;
	name: string;
	description?: string;
	capability?: string;
	spec: string;
	created_at?: string;
}

// Types for agent-linked templates (includes is_default from junction table)
export interface AgentLinkedTemplate extends RequestTemplate {
	is_default?: number | boolean;
}

export interface AgentLinkedResponseMap extends ResponseMap {
	is_default?: number | boolean;
}

// =====================
// REQUEST TEMPLATES CRUD
// =====================

/**
 * Create a new global request template.
 */
export function createRequestTemplate(payload: Omit<RequestTemplate, 'id' | 'created_at'>): RequestTemplate {
	const stmt = db.prepare(`
		INSERT INTO request_templates (name, description, capability, body)
		VALUES (@name, @description, @capability, @body)
		RETURNING *
	`);
	return stmt.get({
		name: payload.name,
		description: payload.description ?? null,
		capability: payload.capability ?? null,
		body: payload.body
	}) as RequestTemplate;
}

/**
 * List all request templates, optionally filtered by capability.
 */
export function listRequestTemplates(filters?: { capability?: string }): RequestTemplate[] {
	if (filters?.capability) {
		// Filter by capability name (parse JSON if needed)
		const stmt = db.prepare(`
			SELECT * FROM request_templates
			WHERE capability IS NOT NULL
			ORDER BY created_at DESC, id DESC
		`);
		const all = stmt.all() as RequestTemplate[];
		return all.filter(t => {
			const capName = extractCapabilityName(t.capability);
			return capName === filters.capability;
		});
	}
	const stmt = db.prepare(`
		SELECT * FROM request_templates
		ORDER BY created_at DESC, id DESC
	`);
	return stmt.all() as RequestTemplate[];
}

/**
 * Get a request template by ID.
 */
export function getRequestTemplateById(id: number): RequestTemplate | undefined {
	const stmt = db.prepare(`SELECT * FROM request_templates WHERE id = ?`);
	return stmt.get(id) as RequestTemplate | undefined;
}

/**
 * Update a request template.
 */
export function updateRequestTemplate(id: number, updates: Partial<Omit<RequestTemplate, 'id' | 'created_at'>>): RequestTemplate | undefined {
	const current = getRequestTemplateById(id);
	if (!current) return undefined;

	const fields = Object.entries(updates)
		.filter(([_, v]) => v !== undefined)
		.map(([k]) => `${k} = @${k}`);

	if (fields.length === 0) {
		return current;
	}

	const stmt = db.prepare(`
		UPDATE request_templates
		SET ${fields.join(', ')}
		WHERE id = @id
		RETURNING *
	`);

	return stmt.get({ id, ...updates }) as RequestTemplate;
}

/**
 * Delete a request template.
 * This will cascade to remove all agent links.
 */
export function deleteRequestTemplate(id: number): void {
	const stmt = db.prepare(`DELETE FROM request_templates WHERE id = ?`);
	stmt.run(id);
}

// =====================
// RESPONSE MAPS CRUD
// =====================

/**
 * Create a new global response map.
 */
export function createResponseMap(payload: Omit<ResponseMap, 'id' | 'created_at'>): ResponseMap {
	const stmt = db.prepare(`
		INSERT INTO response_maps (name, description, capability, spec)
		VALUES (@name, @description, @capability, @spec)
		RETURNING *
	`);
	return stmt.get({
		name: payload.name,
		description: payload.description ?? null,
		capability: payload.capability ?? null,
		spec: payload.spec
	}) as ResponseMap;
}

/**
 * List all response maps, optionally filtered by capability.
 */
export function listResponseMaps(filters?: { capability?: string }): ResponseMap[] {
	if (filters?.capability) {
		const stmt = db.prepare(`
			SELECT * FROM response_maps
			WHERE capability IS NOT NULL
			ORDER BY created_at DESC, id DESC
		`);
		const all = stmt.all() as ResponseMap[];
		return all.filter(m => {
			const capName = extractCapabilityName(m.capability);
			return capName === filters.capability;
		});
	}
	const stmt = db.prepare(`
		SELECT * FROM response_maps
		ORDER BY created_at DESC, id DESC
	`);
	return stmt.all() as ResponseMap[];
}

/**
 * Get a response map by ID.
 */
export function getResponseMapById(id: number): ResponseMap | undefined {
	const stmt = db.prepare(`SELECT * FROM response_maps WHERE id = ?`);
	return stmt.get(id) as ResponseMap | undefined;
}

/**
 * Update a response map.
 */
export function updateResponseMap(id: number, updates: Partial<Omit<ResponseMap, 'id' | 'created_at'>>): ResponseMap | undefined {
	const current = getResponseMapById(id);
	if (!current) return undefined;

	const fields = Object.entries(updates)
		.filter(([_, v]) => v !== undefined)
		.map(([k]) => `${k} = @${k}`);

	if (fields.length === 0) {
		return current;
	}

	const stmt = db.prepare(`
		UPDATE response_maps
		SET ${fields.join(', ')}
		WHERE id = @id
		RETURNING *
	`);

	return stmt.get({ id, ...updates }) as ResponseMap;
}

/**
 * Delete a response map.
 * This will cascade to remove all agent links.
 */
export function deleteResponseMap(id: number): void {
	const stmt = db.prepare(`DELETE FROM response_maps WHERE id = ?`);
	stmt.run(id);
}

// =====================
// UNIQUE NAME HELPERS
// =====================

const findUniqueName = (table: 'request_templates' | 'response_maps', baseName: string, agentName?: string): string => {
	const trimmedBase = baseName.trim();
	const suffixRoot = agentName?.trim() ? agentName.trim() : 'copy';
	const existsStmt = db.prepare(`SELECT 1 FROM ${table} WHERE name = ? LIMIT 1`);
	const exists = (name: string) => !!existsStmt.get(name);

	if (!exists(trimmedBase)) {
		return trimmedBase;
	}

	let candidate = `${trimmedBase} (${suffixRoot})`;
	if (!exists(candidate)) {
		return candidate;
	}

	let counter = 2;
	while (exists(`${trimmedBase} (${suffixRoot} ${counter})`)) {
		counter += 1;
	}

	return `${trimmedBase} (${suffixRoot} ${counter})`;
};

export function getUniqueRequestTemplateName(baseName: string, agentName?: string): string {
	return findUniqueName('request_templates', baseName, agentName);
}

export function getUniqueResponseMapName(baseName: string, agentName?: string): string {
	return findUniqueName('response_maps', baseName, agentName);
}

// =====================
// AGENT-TEMPLATE LINKING
// =====================

/**
 * Link a template to an agent.
 * If isDefault is true, clears existing default first.
 * If isDefault is omitted and no default exists, sets this link as default.
 */
export function linkTemplateToAgent(agentId: number, templateId: number, isDefault?: boolean): void {
	const tx = db.transaction(() => {
		const existingLink = db.prepare(`
			SELECT is_default FROM agent_template_links WHERE agent_id = ? AND template_id = ?
		`).get(agentId, templateId) as { is_default?: number } | undefined;

		const hasDefault = !!db.prepare(`
			SELECT 1 FROM agent_template_links WHERE agent_id = ? AND is_default = 1 LIMIT 1
		`).get(agentId);

		if (isDefault) {
			db.prepare(`UPDATE agent_template_links SET is_default = 0 WHERE agent_id = ?`).run(agentId);
			if (existingLink) {
				db.prepare(`UPDATE agent_template_links SET is_default = 1 WHERE agent_id = ? AND template_id = ?`).run(agentId, templateId);
			} else {
				db.prepare(`
					INSERT INTO agent_template_links (agent_id, template_id, is_default)
					VALUES (?, ?, 1)
				`).run(agentId, templateId);
			}
			return;
		}

		if (!hasDefault) {
			if (existingLink) {
				db.prepare(`UPDATE agent_template_links SET is_default = 1 WHERE agent_id = ? AND template_id = ?`).run(agentId, templateId);
			} else {
				db.prepare(`
					INSERT INTO agent_template_links (agent_id, template_id, is_default)
					VALUES (?, ?, 1)
				`).run(agentId, templateId);
			}
			return;
		}

		if (!existingLink) {
			db.prepare(`
				INSERT INTO agent_template_links (agent_id, template_id, is_default)
				VALUES (?, ?, 0)
			`).run(agentId, templateId);
		}
	});
	tx();
}

/**
 * Unlink a template from an agent.
 */
export function unlinkTemplateFromAgent(agentId: number, templateId: number): void {
	const tx = db.transaction(() => {
		const existing = db.prepare(`
			SELECT is_default FROM agent_template_links WHERE agent_id = ? AND template_id = ?
		`).get(agentId, templateId) as { is_default?: number } | undefined;

		db.prepare(`DELETE FROM agent_template_links WHERE agent_id = ? AND template_id = ?`).run(agentId, templateId);

		if (existing?.is_default) {
			const replacement = db.prepare(`
				SELECT template_id FROM agent_template_links
				WHERE agent_id = ?
				ORDER BY linked_at DESC, template_id DESC
				LIMIT 1
			`).get(agentId) as { template_id?: number } | undefined;

			if (replacement?.template_id) {
				db.prepare(`
					UPDATE agent_template_links
					SET is_default = 1
					WHERE agent_id = ? AND template_id = ?
				`).run(agentId, replacement.template_id);
			}
		}
	});
	tx();
}

/**
 * Get all templates linked to an agent.
 */
export function getAgentTemplates(agentId: number): AgentLinkedTemplate[] {
	const stmt = db.prepare(`
		SELECT t.*, l.is_default, l.linked_at
		FROM request_templates t
		JOIN agent_template_links l ON t.id = l.template_id
		WHERE l.agent_id = ?
		ORDER BY l.is_default DESC, t.created_at DESC
	`);
	return stmt.all(agentId) as AgentLinkedTemplate[];
}

/**
 * Set a template as the default for an agent.
 */
export function setAgentDefaultTemplate(agentId: number, templateId: number): void {
	const tx = db.transaction(() => {
		// Clear all defaults for this agent
		db.prepare(`UPDATE agent_template_links SET is_default = 0 WHERE agent_id = ?`).run(agentId);
		// Set new default
		db.prepare(`UPDATE agent_template_links SET is_default = 1 WHERE agent_id = ? AND template_id = ?`).run(agentId, templateId);
	});
	tx();
}

export function getAgentTemplateLink(agentId: number, templateId: number): { is_default?: number; linked_at?: string } | undefined {
	const stmt = db.prepare(`
		SELECT is_default, linked_at FROM agent_template_links WHERE agent_id = ? AND template_id = ?
	`);
	return stmt.get(agentId, templateId) as { is_default?: number; linked_at?: string } | undefined;
}

export function getTemplateLinkCount(templateId: number): number {
	const row = db.prepare(`
		SELECT COUNT(*) as count FROM agent_template_links WHERE template_id = ?
	`).get(templateId) as { count: number };
	return row.count;
}

// =====================
// AGENT-RESPONSE-MAP LINKING
// =====================

/**
 * Link a response map to an agent.
 */
export function linkResponseMapToAgent(agentId: number, mapId: number, isDefault?: boolean): void {
	const tx = db.transaction(() => {
		const existingLink = db.prepare(`
			SELECT is_default FROM agent_response_map_links WHERE agent_id = ? AND response_map_id = ?
		`).get(agentId, mapId) as { is_default?: number } | undefined;

		const hasDefault = !!db.prepare(`
			SELECT 1 FROM agent_response_map_links WHERE agent_id = ? AND is_default = 1 LIMIT 1
		`).get(agentId);

		if (isDefault) {
			db.prepare(`UPDATE agent_response_map_links SET is_default = 0 WHERE agent_id = ?`).run(agentId);
			if (existingLink) {
				db.prepare(`UPDATE agent_response_map_links SET is_default = 1 WHERE agent_id = ? AND response_map_id = ?`).run(agentId, mapId);
			} else {
				db.prepare(`
					INSERT INTO agent_response_map_links (agent_id, response_map_id, is_default)
					VALUES (?, ?, 1)
				`).run(agentId, mapId);
			}
			return;
		}

		if (!hasDefault) {
			if (existingLink) {
				db.prepare(`UPDATE agent_response_map_links SET is_default = 1 WHERE agent_id = ? AND response_map_id = ?`).run(agentId, mapId);
			} else {
				db.prepare(`
					INSERT INTO agent_response_map_links (agent_id, response_map_id, is_default)
					VALUES (?, ?, 1)
				`).run(agentId, mapId);
			}
			return;
		}

		if (!existingLink) {
			db.prepare(`
				INSERT INTO agent_response_map_links (agent_id, response_map_id, is_default)
				VALUES (?, ?, 0)
			`).run(agentId, mapId);
		}
	});
	tx();
}

/**
 * Unlink a response map from an agent.
 */
export function unlinkResponseMapFromAgent(agentId: number, mapId: number): void {
	const tx = db.transaction(() => {
		const existing = db.prepare(`
			SELECT is_default FROM agent_response_map_links WHERE agent_id = ? AND response_map_id = ?
		`).get(agentId, mapId) as { is_default?: number } | undefined;

		db.prepare(`DELETE FROM agent_response_map_links WHERE agent_id = ? AND response_map_id = ?`).run(agentId, mapId);

		if (existing?.is_default) {
			const replacement = db.prepare(`
				SELECT response_map_id FROM agent_response_map_links
				WHERE agent_id = ?
				ORDER BY linked_at DESC, response_map_id DESC
				LIMIT 1
			`).get(agentId) as { response_map_id?: number } | undefined;

			if (replacement?.response_map_id) {
				db.prepare(`
					UPDATE agent_response_map_links
					SET is_default = 1
					WHERE agent_id = ? AND response_map_id = ?
				`).run(agentId, replacement.response_map_id);
			}
		}
	});
	tx();
}

/**
 * Get all response maps linked to an agent.
 */
export function getAgentResponseMaps(agentId: number): AgentLinkedResponseMap[] {
	const stmt = db.prepare(`
		SELECT m.*, l.is_default, l.linked_at
		FROM response_maps m
		JOIN agent_response_map_links l ON m.id = l.response_map_id
		WHERE l.agent_id = ?
		ORDER BY l.is_default DESC, m.created_at DESC
	`);
	return stmt.all(agentId) as AgentLinkedResponseMap[];
}

/**
 * Set a response map as the default for an agent.
 */
export function setAgentDefaultResponseMap(agentId: number, mapId: number): void {
	const tx = db.transaction(() => {
		db.prepare(`UPDATE agent_response_map_links SET is_default = 0 WHERE agent_id = ?`).run(agentId);
		db.prepare(`UPDATE agent_response_map_links SET is_default = 1 WHERE agent_id = ? AND response_map_id = ?`).run(agentId, mapId);
	});
	tx();
}

export function getAgentResponseMapLink(agentId: number, mapId: number): { is_default?: number; linked_at?: string } | undefined {
	const stmt = db.prepare(`
		SELECT is_default, linked_at FROM agent_response_map_links WHERE agent_id = ? AND response_map_id = ?
	`);
	return stmt.get(agentId, mapId) as { is_default?: number; linked_at?: string } | undefined;
}

export function getResponseMapLinkCount(mapId: number): number {
	const row = db.prepare(`
		SELECT COUNT(*) as count FROM agent_response_map_links WHERE response_map_id = ?
	`).get(mapId) as { count: number };
	return row.count;
}

// =====================
// CAPABILITY LISTING
// =====================

/**
 * Extract capability name from a JSON string or plain string.
 */
function extractCapabilityName(capability: string | null | undefined): string | null {
	if (!capability) return null;
	try {
		const parsed = JSON.parse(capability);
		if (typeof parsed?.name === 'string') {
			return parsed.name;
		}
		if (typeof parsed?.schema === 'string') {
			return parsed.schema;
		}
		return null;
	} catch {
		// If not valid JSON, treat as plain string capability name
		return capability;
	}
}

/**
 * List all distinct capability names from request templates.
 */
export function listRequestTemplateCapabilityNames(): string[] {
	const rows = db.prepare(`
		SELECT DISTINCT capability FROM request_templates
		WHERE capability IS NOT NULL AND capability != ''
	`).all() as Array<{ capability: string }>;

	const names = new Set<string>();
	for (const row of rows) {
		const name = extractCapabilityName(row.capability);
		if (name) {
			names.add(name);
		}
	}

	return Array.from(names).sort();
}

/**
 * List all distinct capability names from response maps.
 */
export function listResponseMapCapabilityNames(): string[] {
	const rows = db.prepare(`
		SELECT DISTINCT capability FROM response_maps
		WHERE capability IS NOT NULL AND capability != ''
	`).all() as Array<{ capability: string }>;

	const names = new Set<string>();
	for (const row of rows) {
		const name = extractCapabilityName(row.capability);
		if (name) {
			names.add(name);
		}
	}

	return Array.from(names).sort();
}
