import { error } from '@sveltejs/kit';
import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';
import { filePath, getFile, opensInline, parseRange } from '#lib/server/files.ts';

// Nome del file da scaricare: in ASCII per i browser vecchi, in UTF-8 per tutti gli altri.
const attachment = (name: string) =>
	`attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;

export const GET: RequestHandler = ({ params, request }) => {
	const f = getFile(params.id);
	const path = f && filePath(f);
	if (!f || !path) error(404, 'Not found');
	const etag = `"${f.sha256}"`;
	const headers: Record<string, string> = {
		'Content-Type': f.mime,
		ETag: etag,
		'Cache-Control': 'private, max-age=31536000, immutable',
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "default-src 'none'",
		'Accept-Ranges': 'bytes'
	};
	if (!opensInline(f.mime)) headers['Content-Disposition'] = attachment(f.name);
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

	const size = statSync(path).size;
	const range = parseRange(request.headers.get('range'), size);
	if (range === 'invalid') return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
	const { start, end } = range ?? { start: 0, end: size - 1 };
	headers['Content-Length'] = String(end - start + 1);
	if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
	// A pezzi dal disco: un brano da 80 MB non passa tutto dalla memoria.
	const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream<Uint8Array>;
	return new Response(body, { status: range ? 206 : 200, headers });
};
