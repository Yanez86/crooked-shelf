import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTimelines } from '#lib/server/timeline.ts';

/** Gli indirizzi delle due cronologie della 0.10 e precedenti: ora le cronologie sono pagine. */
export const GET: RequestHandler = ({ params, locals }) => {
	const which = params.path.split('/')[0] || 'world';
	const tl = which === 'world' || which === 'campaign' ? listTimelines(locals.user, which)[0] : undefined;
	redirect(307, tl ? `/wiki/${tl.slug}` : '/wiki?kind=timeline');
};
