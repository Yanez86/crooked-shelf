import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './db/index.ts';
import { purgeExpiredSessions, purgeExpiredResets, purgeIdleApiTokens } from './auth.ts';
import { purgeOrphanFiles } from './files.ts';
import { pruneAuditLog } from './audit.ts';

const HOUR = 60 * 60 * 1000;
let last = 0;

/** Pulizia periodica, una volta all'ora, dalla prima richiesta che la trova in ritardo (niente timer: un processo solo). */
export function maintenance(now = Date.now()) {
	if (now - last < HOUR) return;
	last = now;
	try {
		purgeExpiredSessions();
		purgeExpiredResets();
		purgeIdleApiTokens();
		purgeOrphanFiles(now);
		pruneAuditLog();
		// I pacchetti mondo caricati per l'anteprima e mai importati.
		const tmp = join(dataDir(), 'tmp');
		for (const name of readdirSync(tmp, { withFileTypes: true })) {
			const p = join(tmp, name.name);
			if (name.isFile() && statSync(p).mtimeMs < now - HOUR) rmSync(p, { force: true });
		}
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Pulizia:', e);
	}
}

/** Solo per i test. */
export const resetMaintenance = () => (last = 0);
