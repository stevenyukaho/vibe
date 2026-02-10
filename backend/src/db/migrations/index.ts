import type Database from 'better-sqlite3';
import type { Migration } from './types';

import migration001 from './001_initial_schema';
import migration002 from './002_add_suite_run_id_to_jobs';
import migration003 from './003_add_token_usage_to_suite_runs';
import migration004 from './004_add_job_polling_columns';

const MIGRATIONS: Migration[] = [
	migration001,
	migration002,
	migration003,
	migration004
];

export function getUserVersion(db: Database.Database): number {
	const raw = db.pragma('user_version', { simple: true }) as unknown;
	const value = typeof raw === 'number'
		? raw
		: Number((raw as { user_version?: unknown } | null)?.user_version ?? raw);

	return Number.isFinite(value) ? value : 0;
}

export function setUserVersion(db: Database.Database, version: number): void {
	db.pragma(`user_version = ${version}`);
}

export function runMigrations(db: Database.Database): void {
	const currentVersion = getUserVersion(db);
	const pending = MIGRATIONS
		.filter(m => m.version > currentVersion)
		.sort((a, b) => a.version - b.version);

	for (const migration of pending) {
		try {
			const run = db.transaction(() => {
				migration.up(db);
				setUserVersion(db, migration.version);
			});
			run();
		} catch (error) {
			throw new Error(
				`Migration ${migration.version} (${migration.name}) failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
}

