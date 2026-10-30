import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { useMemoryDb, schema } from './db/index.ts';
import { filePath, getFile, parseRange, saveResourceFile } from './files.ts';
import { createResource, deleteResource, getResource, listResources, readResourceForm, updateResource } from './resources.ts';
import { galleryImages } from './gallery.ts';
import { formatSize } from '../resources.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };

beforeEach(() => {
	process.env.CS_DATA_DIR = mkdtempSync(join(tmpdir(), 'cs-res-'));
	const db = useMemoryDb();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player']
	] as const)
		db.insert(schema.users).values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 }).run();
});

const bytes = (head: string, size = 64) => Buffer.concat([Buffer.from(head, 'latin1'), Buffer.alloc(size)]);
const save = (buf: Buffer, name: string) => {
	const r = saveResourceFile(buf, name, 1);
	if (!r.ok) throw new Error(r.error);
	return r.file;
};

describe('file delle risorse', () => {
	it('riconosce il tipo dai primi byte, non dal nome', () => {
		expect(save(bytes('ID3\x04'), 'tema.ogg').mime).toBe('audio/mpeg');
		expect(save(Buffer.from([0xff, 0xfb, 0x90, 0x64, ...Buffer.alloc(64)]), 'senza-tag.mp3').mime).toBe('audio/mpeg');
		expect(save(bytes('OggS'), 'vento.ogg').mime).toBe('audio/ogg');
		expect(save(bytes('RIFF\0\0\0\0WAVEfmt '), 'pioggia.wav').mime).toBe('audio/wav');
		expect(save(bytes('fLaC'), 'arpa.flac').mime).toBe('audio/flac');
		expect(save(bytes('\0\0\0\x20ftypM4A '), 'voce.m4a').mime).toBe('audio/mp4');
		expect(save(bytes('%PDF-1.7'), 'dispensa.pdf').mime).toBe('application/pdf');
		// Qualsiasi altro file si tiene, ma si potrà solo scaricare.
		expect(save(bytes('<svg onload="alert(1)">'), 'mappa.svg').mime).toBe('application/octet-stream');
		expect(save(bytes('\0\0\0\x20ftypisom'), 'video.mp4').mime).toBe('application/octet-stream');
	});

	it('le immagini passano dai controlli di sempre', () => {
		const img = save(readFileSync('tests/fixtures/city.png'), 'città.png');
		expect(img).toMatchObject({ mime: 'image/png', name: 'città.png' });
		expect(img.width).toBeGreaterThan(0);
		expect(saveResourceFile(bytes('\x89PNG\r\n\x1a\nrotto'), 'rotto.png', 1)).toEqual({ ok: false, error: 'files.badType' });
		expect(saveResourceFile(Buffer.alloc(0), 'vuoto.mp3', 1)).toEqual({ ok: false, error: 'files.empty' });
	});

	it('parseRange: i pezzi chiesti dal browser per l\'audio', () => {
		expect(parseRange(null, 1000)).toBeNull();
		expect(parseRange('bytes=0-1', 1000)).toEqual({ start: 0, end: 1 });
		expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
		expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
		expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
		expect(parseRange('bytes=1000-', 1000)).toBe('invalid');
		// Più pezzi o richieste scritte male: si manda tutto il file.
		expect(parseRange('bytes=0-1,5-9', 1000)).toBeNull();
		expect(parseRange('bytes=9-5', 1000)).toBeNull();
		expect(parseRange('items=0-1', 1000)).toBeNull();
	});

	it('formatSize', () => {
		expect(formatSize(820_000, 'it')).toBe('820 kB');
		expect(formatSize(12_400_000, 'it')).toBe('12,4 MB');
		expect(formatSize(10, 'en')).toBe('1 kB');
	});
});

describe('risorse', () => {
	let tema: number, segreto: number, ritratto: number;
	beforeEach(() => {
		tema = createResource({ title: 'Tema della locanda', description: '', visibility: 'players' }, save(bytes('ID3'), 'tema.mp3').id, 1);
		segreto = createResource({ title: 'Piano del drago', description: '', visibility: 'master' }, save(bytes('%PDF-'), 'piano.pdf').id, 1);
		ritratto = createResource({ title: 'Ritratto di Elminster', description: '', visibility: 'public' }, save(readFileSync('tests/fixtures/city.png'), 'el.png').id, 1);
	});

	it('ognuno vede solo le risorse che può vedere, divise per tipo', () => {
		const seen = (u: typeof master | typeof alice | null) => listResources(u).map((r) => `${r.kind}:${r.title}`);
		expect(seen(master)).toEqual(['other:Piano del drago', 'image:Ritratto di Elminster', 'audio:Tema della locanda']);
		expect(seen(alice)).toEqual(['image:Ritratto di Elminster', 'audio:Tema della locanda']);
		expect(seen(null)).toEqual(['image:Ritratto di Elminster']);
		expect(getResource(segreto, alice)).toBeUndefined();
		expect(getResource(segreto, master)?.title).toBe('Piano del drago');
		expect(getResource(tema, null)).toBeUndefined();
	});

	it('le immagini delle risorse entrano nella galleria', () => {
		const img = galleryImages(alice).find((i) => i.sources.some((s) => s.kind === 'resource'));
		expect(img?.sources).toEqual([{ kind: 'resource', title: 'Ritratto di Elminster', href: `/resources/${ritratto}` }]);
	});

	it('cambiando o eliminando il file, quello vecchio sparisce anche dal disco', () => {
		const old = getResource(tema, master)!.file;
		const oldPath = filePath(getFile(old.id)!)!;
		const fresh = save(bytes('OggS'), 'tema.ogg');
		updateResource(tema, { title: 'Tema della locanda', description: 'Versione lunga', visibility: 'players' }, fresh.id);
		expect(getResource(tema, master)).toMatchObject({ description: 'Versione lunga', kind: 'audio', file: { id: fresh.id, mime: 'audio/ogg' } });
		expect(getFile(old.id)).toBeUndefined();
		expect(existsSync(oldPath)).toBe(false);

		const freshPath = filePath(getFile(fresh.id)!)!;
		deleteResource(tema);
		expect(getResource(tema, master)).toBeUndefined();
		expect(getFile(fresh.id)).toBeUndefined();
		expect(existsSync(freshPath)).toBe(false);
	});

	it('senza titolo si usa il nome del file', () => {
		const form = (o: Record<string, string>) => {
			const f = new FormData();
			for (const [k, v] of Object.entries(o)) f.set(k, v);
			return f;
		};
		expect(readResourceForm(form({ title: '', visibility: 'master' }), 'Battaglia finale.mp3')).toEqual({
			input: { title: 'Battaglia finale', description: '', visibility: 'master' },
			error: null
		});
		expect(readResourceForm(form({ visibility: 'ovunque' }), '').error).toBe('errors.titleRequired');
		expect(readResourceForm(form({ title: 'X', visibility: 'ovunque' })).input.visibility).toBe('players');
	});
});
