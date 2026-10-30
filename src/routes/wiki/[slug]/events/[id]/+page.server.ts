import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { canView } from '#lib/access.ts';
import { canEditEvent, deleteEvent, getEvent, getTimeline, saveEvent } from '#lib/server/timeline.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { eventVisibilities, readEventForm } from '#lib/server/eventForm.ts';
import { getDb, schema } from '#lib/server/db/index.ts';
import { getPageBySlug, pageChoices } from '#lib/server/pages.ts';
import { eq } from 'drizzle-orm';

/** Un evento della cronologia di questa pagina, che chi guarda può modificare. */
function editable(params: { slug: string; id: string }, u: App.Locals['user']) {
	const page = getPageBySlug(params.slug);
	const tl = page && canView(page, u) ? getTimeline(page.id) : undefined;
	const e = tl ? getEvent(Number(params.id)) : undefined;
	if (!page || !tl || !e || e.timelineId !== tl.id || !canEditEvent(e, u)) error(404, 'Not found');
	return { page, tl, e };
}

export const load: PageServerLoad = ({ params, locals }) => {
	const { page: timeline, tl, e } = editable(params, locals.user);
	const linked = e.pageId ? getDb().select({ title: schema.pages.title }).from(schema.pages).where(eq(schema.pages.id, e.pageId)).get() : null;
	const choices = pageChoices(locals.user);
	return {
		timeline: { slug: timeline.slug, title: timeline.title, mode: tl.mode },
		values: {
			title: e.title,
			description: e.description,
			date: e.year !== null ? { year: e.year, month: e.month, day: e.day } : null,
			approx: e.approx,
			realDate: e.realDate,
			page: choices.find((c) => c.id === e.pageId)?.label ?? linked?.title ?? '',
			visibility: e.visibility
		},
		months: getCalendar().months,
		visibilities: eventVisibilities(locals.user),
		pageTitles: choices.slice(0, 500).map((c) => c.label)
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const { page, tl, e } = editable(params, locals.user);
		const r = readEventForm(await request.formData(), tl, locals.user!, getCalendar());
		if (r.error) return fail(400, { error: r.error, values: r.values });
		saveEvent(r.input, locals.user!.id, e.id);
		redirect(303, `/wiki/${page.slug}#event-${e.id}`);
	},
	delete: async ({ params, locals }) => {
		const { page, e } = editable(params, locals.user);
		deleteEvent(e.id);
		redirect(303, `/wiki/${page.slug}`);
	}
};
