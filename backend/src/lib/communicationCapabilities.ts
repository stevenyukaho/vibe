/**
 * Serializes a capability value to a JSON string for database storage.
 *
 * Accepts:
 * - null/undefined -> null (no capability)
 * - empty string -> null
 * - plain string -> {"name": "value"}
 * - object with `name` (or legacy `schema`) -> {"name": "value"}
 */
export const serializeCapabilities = (value: unknown): string | null => {
	if (value === undefined || value === null) {
		return null;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}

		// Try parsing as JSON
		if (trimmed.startsWith('{')) {
			try {
				const parsed = JSON.parse(trimmed);
				if (parsed && typeof parsed === 'object') {
					const name = typeof parsed.name === 'string' ? parsed.name : undefined;
					const schema = typeof parsed.schema === 'string' ? parsed.schema : undefined;
					if (name || schema) {
						return JSON.stringify({ name: name ?? schema });
					}
				}
				return null;
			} catch {
				// Invalid JSON, treat as capability name
			}
		}

		return JSON.stringify({ name: trimmed });
	}

	if (typeof value === 'object') {
		const obj = value as { name?: string; schema?: string };
		if (obj.name && typeof obj.name === 'string') {
			return JSON.stringify({ name: obj.name });
		}
		if (obj.schema && typeof obj.schema === 'string') {
			return JSON.stringify({ name: obj.schema });
		}
		return null;
	}

	return null;
};

/**
 * Extracts the capability name from a JSON capability string or plain string.
 *
 * @param capability - Can be:
 *   - null/undefined -> null
 *   - empty string -> null
 *   - JSON string like '{"name": "openai-chat"}' -> 'openai-chat'
 *   - plain string -> returns as-is
 */
export function extractCapabilityName(capability: string | null | undefined): string | null {
	if (!capability) {
		return null;
	}

	const trimmed = capability.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith('{')) {
		try {
			const parsed = JSON.parse(trimmed);
			if (parsed && typeof parsed === 'object') {
				if (typeof parsed.name === 'string') {
					return parsed.name;
				}
				if (typeof parsed.schema === 'string') {
					return parsed.schema;
				}
				return null;
			}
		} catch {
			// Not valid JSON, return as-is
			return trimmed;
		}
	}

	return trimmed;
}
