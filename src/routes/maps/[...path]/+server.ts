import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canView } from '#lib/access.ts';
import { pageOfOldMapSlug } from '#lib/server/maps.ts';

/** Gli indirizzi delle mappe della 0.10 e precedenti: ora le mappe sono pagine. */
export const GET: RequestHandler = ({ params, locals, url }) => {
	const [slug, sub] = params.path.split('/');
	if (!slug) redirect(308, '/wiki?kind=map');
	if (slug === 'new') redirect(307, `/wiki/new?kind=map${url.searchParams.has('parent') ? `&parent=${encodeURIComponent(url.searchParams.get('parent')!)}` : ''}`);
	const p = pageOfOldMapSlug(slug);
	if (!p || p.deletedAt !== null || !canView({ ...p, playersCanEdit: false, hasSecret: false }, locals.user)) error(404, 'Not found');
	redirect(308, `/wiki/${p.slug}${sub === 'edit' ? '/edit' : ''}`);
};
