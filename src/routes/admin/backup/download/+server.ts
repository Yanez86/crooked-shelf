import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { audit } from '#lib/server/audit.ts';
import { createBackup } from '#lib/server/backup.ts';

export const GET: RequestHandler = async ({ locals }) => {
	const u = requireAdmin(locals.user);
	audit('backup_downloaded', { userId: u.id, ip: locals.ip });
	const zip = await createBackup();
	const date = new Date().toISOString().slice(0, 10);
	return new Response(zip, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="crooked-shelf-backup-${date}.zip"`,
			'Cache-Control': 'no-store'
		}
	});
};
