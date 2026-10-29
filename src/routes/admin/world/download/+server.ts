import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { exportWorld } from '#lib/server/worldpack.ts';
import { slugify } from '#lib/slug.ts';

/** Il pacchetto si scarica con un modulo GET: le scelte sono nei parametri. */
export const GET: RequestHandler = ({ url, locals }) => {
	const u = requireAdmin(locals.user);
	const q = url.searchParams;
	const ids = (k: string) => q.getAll(k).map(Number).filter((n) => Number.isInteger(n) && n > 0);
	const name = (q.get('name') ?? '').trim().slice(0, 80) || 'world';
	const zip = exportWorld(
		{
			name,
			allPages: q.get('pages') === 'all',
			categoryIds: ids('category'),
			tagIds: ids('tag'),
			maps: q.has('maps'),
			templates: q.has('templates'),
			calendar: q.has('calendar'),
			timeline: q.has('timeline'),
			themes: q.has('themes'),
			secrets: q.has('secrets')
		},
		u
	);
	return new Response(new Uint8Array(zip), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${slugify(name, 'world')}.shelf"`,
			'Cache-Control': 'no-store'
		}
	});
};
