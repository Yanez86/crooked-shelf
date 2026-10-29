import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { createBackup } from '#lib/server/backup.ts';

export const GET: RequestHandler = async ({ locals }) => {
	requireAdmin(locals.user);
	const zip = await createBackup();
	const date = new Date().toISOString().slice(0, 10);
	return new Response(new Uint8Array(zip), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="crooked-shelf-backup-${date}.zip"`,
			'Cache-Control': 'no-store'
		}
	});
};
