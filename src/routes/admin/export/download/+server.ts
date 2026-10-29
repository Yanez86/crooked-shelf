import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { exportMarkdown } from '#lib/server/worldpack.ts';

export const GET: RequestHandler = ({ locals }) => {
	const u = requireAdmin(locals.user);
	const date = new Date().toISOString().slice(0, 10);
	return new Response(new Uint8Array(exportMarkdown(u)), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="crooked-shelf-markdown-${date}.zip"`,
			'Cache-Control': 'no-store'
		}
	});
};
