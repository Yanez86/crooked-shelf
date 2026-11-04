import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { str } from '#lib/server/forms.ts';
import { deleteAppointment, getAppointment, saveAppointment, type AppointmentInput } from '#lib/server/schedule.ts';
import { DATE_RE, localDate, MODES, REPEATS, TIME_RE, webLink, type Mode, type Repeat } from '#lib/schedule.ts';

/** Gli appuntamenti li scrive solo il Master della campagna, se li ha accesi. `new` per uno nuovo. */
function target(locals: App.Locals, id: string) {
	if (!locals.campaign?.schedule || !isMaster(locals.user)) error(404, 'Not found');
	if (id === 'new') return null;
	return getAppointment(Number(id)) ?? error(404, 'Not found');
}

function parse(f: FormData): AppointmentInput | string {
	const title = str(f, 'title', 120);
	const date = str(f, 'date', 10);
	const starts = str(f, 'starts', 5);
	const ends = str(f, 'ends', 5);
	const repeat = str(f, 'repeat') as Repeat;
	const until = str(f, 'until', 10) || null;
	const link = str(f, 'link', 500);
	const inPerson = f.get('inPerson') === 'on';
	const remote = f.get('remote') === 'on';
	if (!title) return 'errors.titleRequired';
	if (!DATE_RE.test(date) || !TIME_RE.test(starts) || !TIME_RE.test(ends) || !REPEATS.includes(repeat)) return 'errors.generic';
	if (until && (!DATE_RE.test(until) || until < date)) return 'schedule.untilBefore';
	if (!inPerson && !remote) return 'schedule.modeRequired';
	// Con un modo solo il Master gioca in quello; con tutti e due sceglie.
	const masterMode = (inPerson && remote ? str(f, 'masterMode') : inPerson ? 'in_person' : 'remote') as Mode;
	if (!MODES.includes(masterMode)) return 'schedule.masterModeRequired';
	if (link && !webLink(link)) return 'schedule.badLink';
	return { title, date, starts, ends, repeat, until: repeat === 'none' ? null : until, inPerson, remote, masterMode, place: inPerson ? str(f, 'place', 200) : '', link: remote && link ? webLink(link) : null };
}

export const load: PageServerLoad = ({ locals, params, url }) => {
	const a = target(locals, params.id);
	const date = url.searchParams.get('date') ?? '';
	return {
		appointment: a ?? { title: '', date: DATE_RE.test(date) ? date : localDate(), starts: '20:00', ends: '00:00', inPerson: true, remote: false, masterMode: 'in_person' as Mode, place: '', link: null, repeat: 'none' as Repeat, until: null },
		isNew: !a,
		campaignLink: locals.campaign!.remoteLink
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const a = target(locals, params.id);
		const input = parse(await request.formData());
		if (typeof input === 'string') return fail(400, { error: input });
		saveAppointment(input, a?.id);
		redirect(303, `/schedule?m=${input.date.slice(0, 7)}`);
	},
	delete: async ({ locals, params }) => {
		const a = target(locals, params.id);
		if (a) deleteAppointment(a.id);
		redirect(303, `/schedule?m=${a?.date.slice(0, 7) ?? ''}`);
	}
};
