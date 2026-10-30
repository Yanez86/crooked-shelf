import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize } from 'image-size';
import { eq } from 'drizzle-orm';
import { dataDir, getDb, schema } from './db/index.ts';

export const MAX_UPLOAD = 25 * 1024 * 1024;
/** Risorse (musica, dispense…): più grandi delle immagini, ma sotto il limite delle richieste (100 MB). */
export const MAX_RESOURCE = 90 * 1024 * 1024;

type FileType = { mime: string; ext: string; test: (b: Buffer) => boolean };
const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString('latin1');

// Il tipo si riconosce dai primi byte del file, non dal nome. Niente SVG: può contenere script.
const IMAGES: FileType[] = [
	{ mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
	{ mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
	{ mime: 'image/gif', ext: 'gif', test: (b) => /^GIF8[79]a/.test(ascii(b, 0, 6)) },
	{ mime: 'image/webp', ext: 'webp', test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' }
];

// Audio che i browser sanno suonare. Gli altri file delle risorse si possono solo scaricare.
const AUDIO: FileType[] = [
	{ mime: 'audio/mpeg', ext: 'mp3', test: (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) },
	{ mime: 'audio/ogg', ext: 'ogg', test: (b) => ascii(b, 0, 4) === 'OggS' },
	{ mime: 'audio/wav', ext: 'wav', test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE' },
	{ mime: 'audio/flac', ext: 'flac', test: (b) => ascii(b, 0, 4) === 'fLaC' },
	{ mime: 'audio/mp4', ext: 'm4a', test: (b) => ascii(b, 4, 8) === 'ftyp' && /^M4[AB] $/.test(ascii(b, 8, 12)) }
];

const PDF: FileType = { mime: 'application/pdf', ext: 'pdf', test: (b) => ascii(b, 0, 5) === '%PDF-' };
const OTHER = 'application/octet-stream';

const TYPES = [...IMAGES, ...AUDIO, PDF];

export type FileRow = typeof schema.files.$inferSelect;
type Saved = { ok: true; file: FileRow } | { ok: false; error: string };

const pathOf = (id: string, ext: string) => join(dataDir(), 'uploads', id.slice(0, 2), `${id}.${ext}`);
const extOf = (mime: string) => TYPES.find((t) => t.mime === mime)?.ext ?? 'bin';

/** Si aprono nel browser solo le immagini e l'audio: tutto il resto (PDF compresi) si scarica. */
export const opensInline = (mime: string) => IMAGES.some((t) => t.mime === mime) || AUDIO.some((t) => t.mime === mime);

function store(buf: Buffer, name: string, mime: string, size: { width: number; height: number }, userId: number): FileRow {
	const sha256 = createHash('sha256').update(buf).digest('hex');
	// Indirizzo casuale e non indovinabile: chi non vede la pagina non può risalire all'immagine.
	const id = randomBytes(16).toString('base64url');
	const path = pathOf(id, extOf(mime));
	mkdirSync(join(path, '..'), { recursive: true });
	writeFileSync(path, buf);
	return getDb()
		.insert(schema.files)
		.values({ id, sha256, name: name.slice(0, 200) || 'file', mime, size: buf.length, ...size, uploadedBy: userId, createdAt: Date.now() })
		.returning()
		.get();
}

/** Salva un'immagine caricata. Restituisce la riga del file o la chiave dell'errore. */
export function saveImage(buf: Buffer, name: string, userId: number): Saved {
	if (buf.length === 0) return { ok: false, error: 'files.empty' };
	if (buf.length > MAX_UPLOAD) return { ok: false, error: 'files.tooBig' };
	const type = IMAGES.find((t) => t.test(buf));
	if (!type) return { ok: false, error: 'files.badType' };
	let size: { width?: number; height?: number };
	try {
		size = imageSize(buf);
	} catch {
		return { ok: false, error: 'files.badType' };
	}
	if (!size.width || !size.height || size.width > 30000 || size.height > 30000) return { ok: false, error: 'files.badType' };
	return { ok: true, file: store(buf, name || 'image', type.mime, { width: size.width, height: size.height }, userId) };
}

/** Salva il file di una risorsa: un'immagine (con i controlli di sempre), un audio o qualsiasi altro file. */
export function saveResourceFile(buf: Buffer, name: string, userId: number): Saved {
	if (buf.length === 0) return { ok: false, error: 'files.empty' };
	if (IMAGES.some((t) => t.test(buf))) return saveImage(buf, name, userId);
	if (buf.length > MAX_RESOURCE) return { ok: false, error: 'resources.tooBig' };
	const type = [...AUDIO, PDF].find((t) => t.test(buf));
	return { ok: true, file: store(buf, name, type?.mime ?? OTHER, { width: 0, height: 0 }, userId) };
}

export function getFile(id: string): FileRow | undefined {
	if (!/^[\w-]{10,40}$/.test(id)) return undefined;
	return getDb().select().from(schema.files).where(eq(schema.files.id, id)).get();
}

/** Dove sta il file sul disco (null se manca). */
export function filePath(f: FileRow): string | null {
	const p = pathOf(f.id, extOf(f.mime));
	return existsSync(p) ? p : null;
}

export function readFile(f: FileRow): Buffer | null {
	const p = filePath(f);
	return p ? readFileSync(p) : null;
}

/** Elimina un file che non serve più. Se una mappa lo usa ancora, resta dov'è. */
export function deleteFile(id: string) {
	const f = getFile(id);
	if (!f) return;
	try {
		getDb().delete(schema.files).where(eq(schema.files.id, id)).run();
	} catch {
		return;
	}
	rmSync(pathOf(f.id, extOf(f.mime)), { force: true });
}

/**
 * Pezzo del file chiesto con «Range: bytes=…»: serve per saltare avanti nell'audio, e su iPhone per suonarlo.
 * null = tutto il file (nessun pezzo, più pezzi o richiesta scritta male); 'invalid' = pezzo fuori dal file.
 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
	const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
	if (!m || (!m[1] && !m[2])) return null;
	// «bytes=-500» sono gli ultimi 500 byte.
	const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
	const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
	if (m[1] && m[2] && Number(m[2]) < start) return null;
	return start < size && start <= end ? { start, end } : 'invalid';
}
