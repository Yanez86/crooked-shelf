import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { canAdd, canEditEvent, listEvents, saveEvent, TIMELINES, type Timeline } from '#lib/server/timeline.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { eventVisibilities, readEventForm } from '#lib/server/eventForm.ts';
import { resolverFor } from '#lib/server/pages.ts';
import { renderInline } from '#lib/content/render.ts';
import { inlineLinks } from '#lib/content/extract.ts';
import { contentLabels } from '#lib/server/pageForm.ts';
import { canView } from '#lib/access.ts';
import { formatDate, weekday } from '#lib/calendar.ts';
import { pageChoices } from '#lib/server/pages.ts';
import { hasRule } from '#lib/server/rules/index.ts';

function which(p: string): Timeline {
	if (!TIMELINES.includes(p as Timeline)) error(404, 'Not found');
	return p as Timeline;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const tl = which(params.which);
	const cal = getCalendar();
	const rows = listEvents(tl, locals.user);
	const resolve = resolverFor(rows.flatMap((r) => inlineLinks(r.description)), locals.user);
	const labels = contentLabels(locals.locale);
	const events = rows.map((r) => {
		const d = r.year !== null ? { year: r.year, month: r.month, day: r.day } : null;
		const pageOk = r.pageSlug && canView({ visibility: r.pageVisibility!, authorId: r.pageAuthor, playersCanEdit: false, hasSecret: false }, locals.user);
		return {
			id: r.id,
			title: r.title,
			html: renderInline(r.description, { resolve, labels, hasRule }),
			when: d ? formatDate(cal, d) : null,
			weekday: d ? weekday(cal, d) : null,
			year: d?.year ?? null,
			yearLabel: d ? formatDate(cal, { year: d.year }) : '',
			ago: d && cal.today ? cal.today.year - d.year : null,
			approx: r.approx,
			realDate: r.realDate,
			page: pageOk ? { slug: r.pageSlug!, title: r.pageTitle! } : null,
			visibility: r.visibility,
			session: r.source === 'session',
			canEdit: canEditEvent(r, locals.user)
		};
	});
	return {
		timeline: tl,
		view: url.searchParams.get('view') === 'line' ? 'line' : 'list',
		events,
		calendarName: cal.name,
		months: cal.months,
		today: cal.today ? formatDate(cal, cal.today) : null,
		canAdd: canAdd(tl, locals.user),
		visibilities: eventVisibilities(locals.user),
		pageTitles: locals.user ? pageChoices(locals.user).slice(0, 500).map((c) => c.label) : []
	};
};

export const actions: Actions = {
	add: async ({ params, request, locals }) => {
		const tl = which(params.which);
		if (!canAdd(tl, locals.user)) return fail(403, { error: 'errors.forbidden', values: null });
		const r = readEventForm(await request.formData(), tl, locals.user!, getCalendar());
		if (r.error) return fail(400, { error: r.error, values: r.values });
		const id = saveEvent(r.input, locals.user!.id);
		return { ok: 'timeline.added', id };
	}
};
