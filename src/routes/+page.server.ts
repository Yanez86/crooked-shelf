import type { PageServerLoad } from './$types';
import { listPages } from '#lib/server/pages.ts';
import { categoryTree } from '#lib/server/taxonomy.ts';

export const load: PageServerLoad = ({ locals }) => {
	const { total, rows } = listPages(locals.user, { limit: 8 });
	return {
		total,
		recent: rows,
		categories: categoryTree(locals.user).roots.map(({ name, slug, count, description }) => ({ name, slug, count, description }))
	};
};
