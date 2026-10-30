import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { canEdit, canView, isMaster } from '#lib/access.ts';
import { backlinks, getPageBySlug, pageMeta, renderPage } from '#lib/server/pages.ts';
import { getFile } from '#lib/server/files.ts';
import { contentLabels } from '#lib/server/pageForm.ts';
import { categoryPath } from '#lib/server/taxonomy.ts';
import { mapsForPage } from '#lib/server/maps.ts';
import { eventsForPage } from '#lib/server/timeline.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { formatDate } from '#lib/calendar.ts';

function pageImage(id: string | null) {
	const f = id ? getFile(id) : undefined;
	return f ? { url: `/files/${f.id}`, width: f.width, height: f.height } : null;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const page = getPageBySlug(params.slug);
	// 404 anche per le pagine nascoste: non riveliamo che esistono.
	if (!page || !canView(page, locals.user)) error(404, 'Not found');
	const meta = pageMeta(page);
	const rendered = renderPage(page, locals.user, contentLabels(locals.locale));
	const cal = getCalendar();
	const when = (e: { year: number | null; month: number | null; day: number | null; approx: string }) =>
		e.approx || (e.year !== null ? formatDate(cal, { year: e.year, month: e.month, day: e.day }) : '');
	return {
		page: {
			slug: page.slug,
			title: page.title,
			visibility: page.visibility,
			updatedAt: page.updatedAt,
			// Chi non è Master non deve sapere nemmeno che ci sono segreti.
			hasSecret: isMaster(locals.user) && page.hasSecret
		},
		image: pageImage(page.imageId),
		html: rendered.html,
		fields: rendered.fields,
		session: page.session
			? {
					number: page.session.number,
					realDate: page.session.realDate,
					world: page.session.world ? formatDate(cal, page.session.world) : null
				}
			: null,
		maps: mapsForPage(page.slug, locals.user),
		events: eventsForPage(page.id, locals.user).map((e) => ({ id: e.id, timeline: e.timeline, title: e.title, when: when(e), realDate: e.realDate })),
		category: categoryPath(page.categoryId),
		tags: meta.tags,
		author: meta.author,
		editor: meta.editor,
		backlinks: backlinks(page.slug, locals.user),
		canEdit: canEdit(page, locals.user)
	};
};
