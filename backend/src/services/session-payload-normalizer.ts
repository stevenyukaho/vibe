import type { ExecutionSession } from '@ibm-vibe/types';

export const normalizeExecutionSessionPayload = (
	rawPayload: Partial<ExecutionSession> | null | undefined
): Partial<ExecutionSession> => {
	const payload: Record<string, unknown> = { ...(rawPayload || {}) };

	if (payload.conversation_id !== undefined) {
		payload.conversation_id = Number(payload.conversation_id);
	}
	if (payload.agent_id !== undefined) {
		payload.agent_id = Number(payload.agent_id);
	}

	// Success is persisted as 0/1 for SQLite compatibility.
	if (payload.success !== undefined) {
		if (typeof payload.success === 'boolean') {
			payload.success = payload.success ? 1 : 0;
		} else if (typeof payload.success === 'number') {
			payload.success = payload.success ? 1 : 0;
		} else {
			payload.success = null;
		}
	} else {
		payload.success = null;
	}

	// Metadata is stored as a JSON string or null.
	if (payload.metadata === undefined || payload.metadata === null) {
		payload.metadata = null;
	} else if (typeof payload.metadata !== 'string') {
		try {
			payload.metadata = JSON.stringify(payload.metadata);
		} catch {
			payload.metadata = null;
		}
	}

	// Error message must be a string or null.
	if (payload.error_message === undefined || payload.error_message === null) {
		payload.error_message = null;
	} else if (typeof payload.error_message !== 'string') {
		try {
			payload.error_message = JSON.stringify(payload.error_message);
		} catch {
			payload.error_message = String(payload.error_message);
		}
	}

	if (payload.started_at && typeof payload.started_at !== 'string') {
		payload.started_at = new Date(payload.started_at as string | number | Date).toISOString();
	}
	if (payload.completed_at && typeof payload.completed_at !== 'string') {
		payload.completed_at = new Date(payload.completed_at as string | number | Date).toISOString();
	}

	return payload as Partial<ExecutionSession>;
};
