import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize } from 'image-size';
import { eq } from 'drizzle-orm';
import { dataDir, getDb, schema } from './db/index.ts';

export const MAX_UPLOAD = 25 * 1024 * 1024;

// Il tipo si riconosce dai primi byte del file, non dal nome. Niente SVG: può contenere script.
const TYPES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
	{ mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
	{ mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
	{ mime: 'image/gif', ext: 'gif', test: (b) => /^GIF8[79]a/.test(b.subarray(0, 6).toString('latin1')) },
	{ mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' }
];

export type FileRow = typeof schema.files.$inferSelect;

const pathOf = (id: string, ext: string) => join(dataDir(), 'uploads', id.slice(0, 2), `${id}.${ext}`);
const extOf = (mime: string) => TYPES.find((t) => t.mime === mime)?.ext ?? 'bin';

/** Salva un'immagine caricata. Restituisce la riga del file o la chiave dell'errore. */
export function saveImage(buf: Buffer, name: string, userId: number): { ok: true; file: FileRow } | { ok: false; error: string } {
	if (buf.length === 0) return { ok: false, error: 'files.empty' };
	if (buf.length > MAX_UPLOAD) return { ok: false, error: 'files.tooBig' };
	const type = TYPES.find((t) => t.test(buf));
	if (!type) return { ok: false, error: 'files.badType' };
	let size: { width?: number; height?: number };
	try {
		size = imageSize(buf);
	} catch {
		return { ok: false, error: 'files.badType' };
	}
	if (!size.width || !size.height || size.width > 30000 || size.height > 30000) return { ok: false, error: 'files.badType' };

	const sha256 = createHash('sha256').update(buf).digest('hex');
	// Indirizzo casuale e non indovinabile: chi non vede la pagina non può risalire all'immagine.
	const id = randomBytes(16).toString('base64url');
	const path = pathOf(id, type.ext);
	mkdirSync(join(path, '..'), { recursive: true });
	writeFileSync(path, buf);
	const file = getDb()
		.insert(schema.files)
		.values({
			id,
			sha256,
			name: name.slice(0, 200) || 'image',
			mime: type.mime,
			size: buf.length,
			width: size.width,
			height: size.height,
			uploadedBy: userId,
			createdAt: Date.now()
		})
		.returning()
		.get();
	return { ok: true, file };
}

export function getFile(id: string): FileRow | undefined {
	if (!/^[\w-]{10,40}$/.test(id)) return undefined;
	return getDb().select().from(schema.files).where(eq(schema.files.id, id)).get();
}

export function readFile(f: FileRow): Buffer | null {
	const p = pathOf(f.id, extOf(f.mime));
	return existsSync(p) ? readFileSync(p) : null;
}
