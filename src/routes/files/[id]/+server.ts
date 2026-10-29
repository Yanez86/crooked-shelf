import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFile, readFile } from '#lib/server/files.ts';

export const GET: RequestHandler = ({ params, request }) => {
	const f = getFile(params.id);
	const buf = f && readFile(f);
	if (!f || !buf) error(404, 'Not found');
	const etag = `"${f.sha256}"`;
	const headers = {
		'Content-Type': f.mime,
		ETag: etag,
		'Cache-Control': 'private, max-age=31536000, immutable',
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "default-src 'none'"
	};
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
	return new Response(new Uint8Array(buf), { headers });
};
