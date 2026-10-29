import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listPages } from '#lib/server/pages.ts';
import { categoryWithDescendants, getCategoryBySlug, getTagBySlug, categoryTree, listTags } from '#lib/server/taxonomy.ts';

const PER_PAGE = 30;

export const load: PageServerLoad = ({ url, locals }) => {
	const catSlug = url.searchParams.get('category');
	const tagSlug = url.searchParams.get('tag');
	const sort = url.searchParams.get('sort') === 'title' ? 'title' : 'updated';
	const n = Math.max(1, Number(url.searchParams.get('p')) || 1);

	const category = catSlug ? getCategoryBySlug(catSlug) : undefined;
	const tag = tagSlug ? getTagBySlug(tagSlug) : undefined;
	if ((catSlug && !category) || (tagSlug && !tag)) error(404, 'Not found');

	const { total, rows } = listPages(locals.user, {
		categoryIds: category ? categoryWithDescendants(category.id) : undefined,
		tagId: tag?.id,
		sort,
		limit: PER_PAGE,
		offset: (n - 1) * PER_PAGE
	});
	return {
		rows,
		total,
		page: n,
		pages: Math.max(1, Math.ceil(total / PER_PAGE)),
		sort,
		category: category ? { name: category.name, slug: category.slug, id: category.id, description: category.description } : null,
		tag: tag ? { name: tag.name, slug: tag.slug, color: tag.color } : null,
		categories: categoryTree(locals.user).flat.map(({ label, slug }) => ({ label, slug })),
		tags: listTags(locals.user).map(({ name, slug }) => ({ name, slug })),
		deleted: url.searchParams.has('deleted')
	};
};
