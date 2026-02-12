import type { Migration } from './types';

const shouldLog = process.env.NODE_ENV !== 'test';
const logError = (...args: unknown[]) => {
	/* istanbul ignore next */
	if (shouldLog) console.error(...args);
};

const migration: Migration = {
	version: 16,
	name: 'Backfill conversation template/map ids to global ids',
	up: (db) => {
		try {
			db.exec(`
		UPDATE conversations
		SET default_request_template_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversations.default_request_template_id
		)
		WHERE default_request_template_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversations.default_request_template_id
		);
	`);

			db.exec(`
		UPDATE conversations
		SET default_response_map_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversations.default_response_map_id
		)
		WHERE default_response_map_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversations.default_response_map_id
		);
	`);

			db.exec(`
		UPDATE conversation_messages
		SET request_template_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversation_messages.request_template_id
		)
		WHERE request_template_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'request_template'
			AND m.legacy_id = conversation_messages.request_template_id
		);
	`);

			db.exec(`
		UPDATE conversation_messages
		SET response_map_id = (
			SELECT global_id FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversation_messages.response_map_id
		)
		WHERE response_map_id IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM legacy_template_mappings m
			WHERE m.kind = 'response_map'
			AND m.legacy_id = conversation_messages.response_map_id
		);
	`);
		} catch (e) {
			logError('Conversation template-id backfill failed', e);
		}
	}
};

export default migration;
