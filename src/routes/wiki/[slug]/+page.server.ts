import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { canEdit, canView, isMaster } from '#lib/access.ts';
import { backlinks, getPageBySlug, pageMeta } from '#lib/server/pages.ts';
import { pageView } from '#lib/server/pageView.ts';
import { categoryPath } from '#lib/server/taxonomy.ts';
import { mapsForPage } from '#lib/server/maps.ts';
import { eventsForPage } from '#lib/server/timeline.ts';
import { mapActions, mapView } from '#lib/server/mapPage.ts';
import { addEvent, timelineView } from '#lib/server/timelinePage.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { formatDate } from '#lib/calendar.ts';
import { canCreateKind } from '#lib/pageKinds.ts';

/** 404 anche per le pagine nascoste: non riveliamo che esistono. */
function visiblePage(slug: string, u: App.Locals['user']) {
	const page = getPageBySlug(slug);
	if (!page || !canView(page, u)) error(404, 'Not found');
	return page;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const page = visiblePage(params.slug, locals.user);
	const meta = pageMeta(page);
	const cal = getCalendar();
	const when = (e: { year: number | null; month: number | null; day: number | null; approx: string }) =>
		e.approx || (e.year !== null ? formatDate(cal, { year: e.year, month: e.month, day: e.day }) : '');
	return {
		page: {
			slug: page.slug,
			title: page.title,
			kind: page.kind,
			visibility: page.visibility,
			updatedAt: page.updatedAt,
			// Chi non è Master non deve sapere nemmeno che ci sono segreti.
			hasSecret: isMaster(locals.user) && page.hasSecret
		},
		...pageView(page, locals.user, locals.locale),
		// Quello che c'è in più nelle pagine di tipo mappa e cronologia.
		mapData: page.kind === 'map' ? mapView(page, locals.user, locals.locale) : null,
		timelineData: page.kind === 'timeline' ? timelineView(page, locals.user, locals.locale, url) : null,
		// Un template si fotocopia da qui; una nuova mappa può nascere dentro questa.
		canCopy: page.kind === 'template' && canCreateKind('page', locals.user),
		maps: mapsForPage(page.slug, locals.user),
		events: eventsForPage(page.id, locals.user).map((e) => ({ id: e.id, title: e.title, when: when(e), realDate: e.realDate, timeline: e.timeline })),
		category: categoryPath(page.categoryId),
		tags: meta.tags,
		author: meta.author,
		editor: meta.editor,
		backlinks: backlinks(page.slug, locals.user),
		canEdit: canEdit(page, locals.user)
	};
};

const form = async (request: Request) => await request.formData();

export const actions: Actions = {
	pin: async ({ params, request, locals }) => mapActions.pin(visiblePage(params.slug, locals.user), locals.user, await form(request)),
	deletePin: async ({ params, request, locals }) => mapActions.deletePin(visiblePage(params.slug, locals.user), locals.user, await form(request)),
	layer: async ({ params, request, locals }) => mapActions.layer(visiblePage(params.slug, locals.user), locals.user, await form(request)),
	deleteLayer: async ({ params, request, locals }) => mapActions.deleteLayer(visiblePage(params.slug, locals.user), locals.user, await form(request)),
	addEvent: async ({ params, request, locals }) => addEvent(visiblePage(params.slug, locals.user), locals.user, await form(request))
};
