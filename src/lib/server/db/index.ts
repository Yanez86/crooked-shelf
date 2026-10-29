import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as schema from './schema.ts';
import { MIGRATIONS } from './migrations.ts';

export type DB = BetterSQLite3Database<typeof schema>;

let sqlite: Database.Database | undefined;
let db: DB | undefined;

/** Cartella dei dati (database e, in futuro, file caricati). */
export function dataDir(): string {
	return resolve(process.env.CS_DATA_DIR ?? 'data');
}

function migrate(conn: Database.Database) {
	const current = conn.pragma('user_version', { simple: true }) as number;
	for (let v = current; v < MIGRATIONS.length; v++) {
		conn.transaction(() => {
			conn.exec(MIGRATIONS[v]);
			conn.pragma(`user_version = ${v + 1}`);
		})();
	}
}

/** Apre il database alla prima richiesta (non durante la build). */
export function getSqlite(): Database.Database {
	if (!sqlite) {
		const dir = dataDir();
		mkdirSync(dir, { recursive: true });
		sqlite = new Database(join(dir, 'crooked-shelf.db'));
		sqlite.pragma('journal_mode = WAL');
		sqlite.pragma('foreign_keys = ON');
		sqlite.pragma('busy_timeout = 5000');
		migrate(sqlite);
	}
	return sqlite;
}

export function getDb(): DB {
	if (!db) db = drizzle(getSqlite(), { schema });
	return db;
}

/** Solo per i test: database in memoria. */
export function useMemoryDb(): DB {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	migrate(sqlite);
	db = drizzle(sqlite, { schema });
	return db;
}

export { schema };
