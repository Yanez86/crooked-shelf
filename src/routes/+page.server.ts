import type { PageServerLoad } from './$types';
import { listPages } from '#lib/server/pages.ts';
import { categoryTree } from '#lib/server/taxonomy.ts';
import { listMaps } from '#lib/server/maps.ts';
import { listTimelines } from '#lib/server/timeline.ts';

export const load: PageServerLoad = ({ locals }) => {
	// I template sono attrezzi per fare pagine: tra le ultime modifiche non compaiono.
	const { total, rows } = listPages(locals.user, { limit: 8, noTemplates: true });
	return {
		total,
		// Nessuna pagina scritta: le cronologie preparate alla creazione della wiki non contano.
		empty: listPages(locals.user, { kind: 'page', limit: 1 }).total === 0,
		recent: rows,
		world: [
			...listMaps(locals.user).filter((m) => m.parentId === null).map(({ slug, title }) => ({ slug, title, kind: 'map' })),
			...listTimelines(locals.user).map(({ slug, title }) => ({ slug, title, kind: 'timeline' }))
		],
		categories: categoryTree(locals.user).roots.map(({ name, slug, count, description }) => ({ name, slug, count, description }))
	};
};
