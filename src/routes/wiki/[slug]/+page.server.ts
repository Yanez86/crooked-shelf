import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { canEdit, canView, isMaster } from '#lib/access.ts';
import { backlinks, getPageBySlug, pageMeta, setPageImage } from '#lib/server/pages.ts';
import { pageView } from '#lib/server/pageView.ts';
import { saveImage } from '#lib/server/files.ts';
import { categoryPath } from '#lib/server/taxonomy.ts';
import { mapsForPage } from '#lib/server/maps.ts';
import { eventsForPage } from '#lib/server/timeline.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { formatDate } from '#lib/calendar.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const page = getPageBySlug(params.slug);
	// 404 anche per le pagine nascoste: non riveliamo che esistono.
	if (!page || !canView(page, locals.user)) error(404, 'Not found');
	const meta = pageMeta(page);
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
		...pageView(page, locals.user, locals.locale),
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

/** Le azioni sull'immagine della pagina: solo chi può modificare la pagina. */
function editable(slug: string, u: App.Locals['user']) {
	const page = getPageBySlug(slug);
	if (!page || !canEdit(page, u)) error(404, 'Not found');
	return { page, user: u! };
}

export const actions: Actions = {
	image: async ({ params, request, locals }) => {
		const { page, user } = editable(params.slug, locals.user);
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { imageError: 'files.empty' });
		const r = saveImage(Buffer.from(await file.arrayBuffer()), file.name, user.id);
		if (!r.ok) return fail(400, { imageError: r.error });
		setPageImage(page.id, r.file.id);
		return { imageOk: 'pageImage.saved' };
	},
	removeImage: async ({ params, locals }) => {
		const { page } = editable(params.slug, locals.user);
		setPageImage(page.id, null);
		return { imageOk: 'pageImage.removed' };
	}
};
