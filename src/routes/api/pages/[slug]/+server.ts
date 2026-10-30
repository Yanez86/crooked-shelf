import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canView } from '#lib/access.ts';
import { getPageBySlug } from '#lib/server/pages.ts';
import { pageView } from '#lib/server/pageView.ts';

/** Una pagina da leggere sopra la mappa: come /wiki/<slug>, senza i segreti per chi non è Master. */
export const GET: RequestHandler = ({ params, locals }) => {
	const page = getPageBySlug(params.slug);
	if (!page || !canView(page, locals.user)) error(404, 'Not found');
	return json({ slug: page.slug, title: page.title, ...pageView(page, locals.user, locals.locale) });
};
