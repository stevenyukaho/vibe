/**
 * Normalization utilities for DB insert payloads.
 *
 * Why needed: better-sqlite3 uses named parameter bindings and will throw
 * `RangeError: Missing named parameter "<name>"` if a referenced binding is not
 * provided in the object passed to statement.run/get(), even when the SQL
 * column has a DEFAULT. These helpers ensure all placeholders are always bound
 * with sane defaults and types (string/number/null), avoiding runtime errors.
 */

export interface ConversationMessageInsertPayload {
	conversation_id: number;
	sequence: number;
	role: string;
	content: string;
	metadata: string | null;
}

export function normalizeConversationMessageInsert(message: {
	conversation_id: number;
	sequence?: number;
	role?: string;
	content?: string;
	metadata?: unknown;
}): ConversationMessageInsertPayload {
	const conversationId = Number(message.conversation_id);
	const sequence = message.sequence !== undefined ? Number(message.sequence) : 1;

	let role = message.role ?? 'user';
	if (typeof role !== 'string') {
		role = String(role);
	}

	let content = message.content ?? '';
	if (typeof content !== 'string') {
		content = String(content);
	}

	let metadata: string | null = null;
	if (message.metadata === null || message.metadata === undefined) {
		metadata = null;
	} else if (typeof message.metadata === 'string') {
		metadata = message.metadata;
	} else {
		try {
			metadata = JSON.stringify(message.metadata);
		} catch (_e) {
			metadata = null;
		}
	}

	return {
		conversation_id: conversationId,
		sequence,
		role,
		content,
		metadata
	};
}

export interface SuiteEntryInsertPayload {
	parent_suite_id: number;
	sequence: number | null;
	test_id: number | null;
	conversation_id: number | null;
	child_suite_id: number | null;
	agent_id_override: number | null;
}

export function normalizeSuiteEntryInsert(entry: {
	parent_suite_id: number;
	sequence?: number;
	test_id?: number;
	conversation_id?: number;
	child_suite_id?: number;
	agent_id_override?: number;
}): SuiteEntryInsertPayload {
	return {
		parent_suite_id: Number(entry.parent_suite_id),
		sequence: entry.sequence !== undefined ? Number(entry.sequence) : null,
		test_id: entry.test_id !== undefined ? Number(entry.test_id) : null,
		conversation_id: entry.conversation_id !== undefined ? Number(entry.conversation_id) : null,
		child_suite_id: entry.child_suite_id !== undefined ? Number(entry.child_suite_id) : null,
		agent_id_override: entry.agent_id_override !== undefined ? Number(entry.agent_id_override) : null
	};
}
