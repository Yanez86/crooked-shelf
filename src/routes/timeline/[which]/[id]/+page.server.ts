import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { canEditEvent, deleteEvent, getEvent, saveEvent, TIMELINES, type Timeline } from '#lib/server/timeline.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { eventVisibilities, readEventForm } from '#lib/server/eventForm.ts';
import { getDb, schema } from '#lib/server/db/index.ts';
import { pageChoices } from '#lib/server/pages.ts';
import { eq } from 'drizzle-orm';

function editable(params: { which: string; id: string }, u: App.Locals['user']) {
	const e = getEvent(Number(params.id));
	if (!e || e.timeline !== params.which || !TIMELINES.includes(e.timeline) || !canEditEvent(e, u)) error(404, 'Not found');
	return e;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const e = editable(params, locals.user);
	const page = e.pageId ? getDb().select({ title: schema.pages.title }).from(schema.pages).where(eq(schema.pages.id, e.pageId)).get() : null;
	const choices = pageChoices(locals.user);
	return {
		timeline: e.timeline as Timeline,
		values: {
			title: e.title,
			description: e.description,
			date: e.year !== null ? { year: e.year, month: e.month, day: e.day } : null,
			approx: e.approx,
			realDate: e.realDate,
			page: choices.find((c) => c.id === e.pageId)?.label ?? page?.title ?? '',
			visibility: e.visibility
		},
		months: getCalendar().months,
		visibilities: eventVisibilities(locals.user),
		pageTitles: choices.slice(0, 500).map((c) => c.label)
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const e = editable(params, locals.user);
		const r = readEventForm(await request.formData(), e.timeline, locals.user!, getCalendar());
		if (r.error) return fail(400, { error: r.error, values: r.values });
		saveEvent(r.input, locals.user!.id, e.id);
		redirect(303, `/timeline/${e.timeline}#event-${e.id}`);
	},
	delete: async ({ params, locals }) => {
		const e = editable(params, locals.user);
		deleteEvent(e.id);
		redirect(303, `/timeline/${e.timeline}`);
	}
};
