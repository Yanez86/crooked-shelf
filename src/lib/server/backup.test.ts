import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unzipSync } from 'fflate';
import { useMemoryDb, schema } from './db/index.ts';
import { createBackup } from './backup.ts';

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cs-test-'));
	process.env.CS_DATA_DIR = dir;
	useMemoryDb().insert(schema.users).values({ id: 1, username: 'dm', displayName: 'DM', passwordHash: 'x', role: 'admin', createdAt: 0 }).run();
});
afterEach(() => {
	delete process.env.CS_DATA_DIR;
	rmSync(dir, { recursive: true, force: true });
});

describe('backup', () => {
	it('è uno zip a pezzi con database, immagini e plugin', async () => {
		mkdirSync(join(dir, 'uploads', 'ab'), { recursive: true });
		mkdirSync(join(dir, 'plugins', 'mio'), { recursive: true });
		const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
		writeFileSync(join(dir, 'uploads', 'ab', 'abc.png'), big);
		writeFileSync(join(dir, 'plugins', 'mio', 'plugin.json'), '{"id":"mio"}');
		const stream = await createBackup();
		const parts: Uint8Array[] = [];
		const reader = stream.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			parts.push(value);
		}
		expect(parts.length).toBeGreaterThan(1);
		const zip = unzipSync(Buffer.concat(parts));
		expect(Object.keys(zip).sort()).toEqual(['BACKUP.txt', 'crooked-shelf.db', 'plugins/mio/plugin.json', 'uploads/ab/abc.png']);
		// Confronto byte a byte: toEqual su 3 milioni di elementi impiega minuti.
		expect(Buffer.compare(Buffer.from(zip['uploads/ab/abc.png']), Buffer.from(big))).toBe(0);
		expect(new TextDecoder().decode(zip['crooked-shelf.db']).slice(0, 15)).toBe('SQLite format 3');
	});
});
