import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync, type Zippable } from 'fflate';
import { dataDir, getSqlite } from './db/index.ts';

function addDir(out: Zippable, base: string, dir: string) {
	if (!existsSync(dir)) return;
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) addDir(out, base, full);
		else out[relative(base, full).split('\\').join('/')] = readFileSync(full);
	}
}

/**
 * Backup completo: il database (copia coerente anche mentre la wiki è in uso),
 * le immagini caricate e i plugin installati. Si ripristina con tools/restore.mjs.
 */
export async function createBackup(): Promise<Uint8Array> {
	const tmp = mkdtempSync(join(tmpdir(), 'cs-backup-'));
	try {
		const dbCopy = join(tmp, 'crooked-shelf.db');
		await getSqlite().backup(dbCopy);
		const files: Zippable = {
			'crooked-shelf.db': readFileSync(dbCopy),
			'BACKUP.txt': new TextEncoder().encode(
				`Crooked Shelf ${__APP_VERSION__}\nBackup del ${new Date().toISOString()}\nRipristino: node tools/restore.mjs <questo file> <cartella dei dati>\n`
			)
		};
		addDir(files, dataDir(), join(dataDir(), 'uploads'));
		addDir(files, dataDir(), join(dataDir(), 'plugins'));
		return zipSync(files, { level: 6 });
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}
