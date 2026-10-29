import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { canEdit, canView, isMaster } from '#lib/access.ts';
import { backlinks, getPageBySlug, pageMeta, renderPage } from '#lib/server/pages.ts';
import { contentLabels } from '#lib/server/pageForm.ts';
import { categoryPath } from '#lib/server/taxonomy.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const page = getPageBySlug(params.slug);
	// 404 anche per le pagine nascoste: non riveliamo che esistono.
	if (!page || !canView(page, locals.user)) error(404, 'Not found');
	const meta = pageMeta(page);
	return {
		page: {
			slug: page.slug,
			title: page.title,
			visibility: page.visibility,
			updatedAt: page.updatedAt,
			// Chi non è Master non deve sapere nemmeno che ci sono segreti.
			hasSecret: isMaster(locals.user) && page.hasSecret
		},
		html: renderPage(page, locals.user, contentLabels(locals.locale)),
		category: categoryPath(page.categoryId),
		tags: meta.tags,
		author: meta.author,
		editor: meta.editor,
		backlinks: backlinks(page.slug, locals.user),
		canEdit: canEdit(page, locals.user)
	};
};
