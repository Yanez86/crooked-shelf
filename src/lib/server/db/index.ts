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

/** Porta il database all'ultima versione (o fino a `upTo`, per i test delle migrazioni). */
export function migrate(conn: Database.Database, upTo = MIGRATIONS.length) {
	const current = conn.pragma('user_version', { simple: true }) as number;
	for (let v = current; v < upTo; v++) {
		const m = MIGRATIONS[v];
		const rebuild = typeof m === 'object';
		// Dentro una transazione questo PRAGMA non ha effetto.
		if (rebuild) conn.pragma('foreign_keys = OFF');
		try {
			conn.transaction(() => {
				if (typeof m === 'string') conn.exec(m);
				else if (typeof m === 'function') m(conn);
				else m.rebuild(conn);
				conn.pragma(`user_version = ${v + 1}`);
			})();
		} finally {
			if (rebuild) conn.pragma('foreign_keys = ON');
		}
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

/** Solo per i test: database in memoria (`upTo`: fermo a una migrazione, per provare quelle dopo). */
export function useMemoryDb(upTo?: number): DB {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	migrate(sqlite, upTo);
	db = drizzle(sqlite, { schema });
	return db;
}

export { schema };
