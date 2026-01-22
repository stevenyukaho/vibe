/**
 * Input type for capability matching.
 * Can be a JSON string, an object with `name`, or null/undefined.
 */
export type CapabilityInput = string | { name?: string } | null | undefined;

export interface CapabilityMatchResult {
	ok: boolean;
	reasons: string[];
}

/**
 * Extracts the capability name from various input formats.
 *
 * Supports:
 * - Plain string: "openai-chat" -> "openai-chat"
 * - JSON object with `name` (or legacy `schema`): {"name": "openai-chat"} -> "openai-chat"
 * - JSON string: '{"name": "openai-chat"}' -> "openai-chat"
 */
export const extractCapabilityName = (value: CapabilityInput): string | null => {
	if (!value) {
		return null;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
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
				// Not valid JSON, treat as plain capability name
			}
		}

		return trimmed;
	}

	if (typeof value === 'object') {
		if (value.name) {
			return value.name;
		}
		if ((value as { schema?: string }).schema) {
			return (value as { schema?: string }).schema!;
		}
		return null;
	}
	return null;
};

/**
 * Matches a required capability against an available capability.
 *
 * The matching is based on the capability `name` field (or `schema` for backward compat).
 * If no requirement is specified, any capability is accepted.
 *
 * @param requirement - What the conversation requires
 * @param available - What the template/map provides
 * @returns Match result with ok=true if compatible, or reasons for failure
 */
export const matchCapabilities = (requirement: CapabilityInput, available: CapabilityInput): CapabilityMatchResult => {
	const requiredName = extractCapabilityName(requirement);

	if (!requiredName) {
		return { ok: true, reasons: [] };
	}

	const availableName = extractCapabilityName(available);

	if (!availableName) {
		return {
			ok: false,
			reasons: [`required capability "${requiredName}" but template/map has no capability defined`]
		};
	}

	if (requiredName !== availableName) {
		return {
			ok: false,
			reasons: [`capability mismatch: required "${requiredName}", got "${availableName}"`]
		};
	}

	return { ok: true, reasons: [] };
};

/**
 * Parses capability input into an object (for backward compatibility).
 * Prefer using extractCapabilityName() for new code.
 */
export const parseCapabilityInput = (value: CapabilityInput): Record<string, unknown> | null => {
	if (!value) {
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
				return parsed && typeof parsed === 'object' ? parsed : null;
			} catch {
				return null;
			}
		}

		return { name: trimmed };
	}

	if (typeof value === 'object') {
		return value;
	}

	return null;
};
