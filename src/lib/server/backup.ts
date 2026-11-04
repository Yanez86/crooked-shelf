import { createReadStream, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { Zip, ZipDeflate } from 'fflate';
import { dataDir, getSqlite } from './db/index.ts';

type Entry = { name: string; path?: string; data?: Uint8Array };

function addDir(out: Entry[], base: string, dir: string) {
	if (!existsSync(dir)) return;
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) addDir(out, base, full);
		else out.push({ name: relative(base, full).split('\\').join('/'), path: full });
	}
}

/** Quanti pezzi dello zip possono aspettare che il browser li scarichi, prima di fermare la lettura dal disco. */
const AHEAD = 8;

/**
 * Backup completo: il database (copia coerente anche mentre la wiki è in uso), le immagini caricate e i plugin
 * installati. Si ripristina con tools/restore.mjs.
 * Lo zip esce a pezzi, un file alla volta, letto dal disco mentre il browser lo scarica: una wiki con molti GB di
 * immagini non passa dalla memoria.
 */
export async function createBackup(): Promise<ReadableStream<Uint8Array>> {
	const tmp = mkdtempSync(join(tmpdir(), 'cs-backup-'));
	const dbCopy = join(tmp, 'crooked-shelf.db');
	try {
		await getSqlite().backup(dbCopy);
	} catch (e) {
		rmSync(tmp, { recursive: true, force: true });
		throw e;
	}
	const entries: Entry[] = [
		{ name: 'crooked-shelf.db', path: dbCopy },
		{
			name: 'BACKUP.txt',
			data: new TextEncoder().encode(
				`Crooked Shelf ${__APP_VERSION__}\nBackup del ${new Date().toISOString()}\nRipristino: node tools/restore.mjs <questo file> <cartella dei dati>\n`
			)
		}
	];
	addDir(entries, dataDir(), join(dataDir(), 'uploads'));
	addDir(entries, dataDir(), join(dataDir(), 'plugins'));

	const queue: Uint8Array[] = [];
	let done = false;
	let failed: Error | null = null;
	let wake: (() => void)[] = [];
	const notify = () => {
		const w = wake;
		wake = [];
		for (const f of w) f();
	};
	const wait = () => new Promise<void>((r) => wake.push(r));
	const cleanup = () => rmSync(tmp, { recursive: true, force: true });

	const zip = new Zip((err, chunk, final) => {
		if (err) failed = err;
		else queue.push(chunk);
		if (final) done = true;
		notify();
	});

	let cancelled = false;
	const feed = async () => {
		try {
			for (const e of entries) {
				if (cancelled) return;
				const f = new ZipDeflate(e.name, { level: 6 });
				zip.add(f);
				if (e.data) f.push(e.data, true);
				else {
					for await (const chunk of createReadStream(e.path!, { highWaterMark: 1024 * 1024 })) {
						if (cancelled) return;
						f.push(new Uint8Array(chunk as Buffer));
						while (queue.length > AHEAD && !cancelled) await wait();
					}
					f.push(new Uint8Array(0), true);
				}
			}
			zip.end();
		} catch (e) {
			failed = e as Error;
			notify();
		} finally {
			cleanup();
		}
	};
	void feed();

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			while (!queue.length && !done && !failed) await wait();
			if (failed) {
				controller.error(failed);
				return;
			}
			while (queue.length) controller.enqueue(queue.shift()!);
			notify();
			if (done && !queue.length) controller.close();
		},
		cancel() {
			cancelled = true;
			zip.terminate();
			notify();
		}
	});
}
