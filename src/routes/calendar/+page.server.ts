import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { getCalendar, saveSettings } from '#lib/server/settings.ts';
import { recomputeSortKeys } from '#lib/server/timeline.ts';
import { formatDate, fromText, preset, PRESETS, toText, yearDays, type CalendarText, type Preset } from '#lib/calendar.ts';

const TEXT_KEYS: (keyof CalendarText)[] = ['name', 'months', 'weekdays', 'eras', 'leapEvery', 'leapOffset', 'leapMonth', 'leapDays', 'leapSkip', 'leapKeep', 'todayYear', 'todayMonth', 'todayDay'];

export const load: PageServerLoad = ({ locals }) => {
	const cal = getCalendar();
	return {
		calendar: cal,
		yearLength: yearDays(cal, 1),
		today: cal.today ? formatDate(cal, cal.today) : null,
		text: toText(cal),
		presets: [...PRESETS],
		canEdit: isMaster(locals.user)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!isMaster(locals.user)) return fail(403, { error: 'errors.forbidden', text: null, line: null });
		const f = await request.formData();
		const text = Object.fromEntries(TEXT_KEYS.map((k) => [k, String(f.get(k) ?? '').slice(0, 5000)])) as unknown as CalendarText;
		const r = fromText(text);
		if (!r.ok) return fail(400, { error: r.error, line: r.line ?? null, text });
		saveSettings({ calendar: r.cal });
		recomputeSortKeys(r.cal);
		return { ok: 'calendar.saved' };
	},
	preset: async ({ request, locals }) => {
		if (!isMaster(locals.user)) return fail(403, { error: 'errors.forbidden', text: null, line: null });
		const id = String((await request.formData()).get('preset')) as Preset;
		if (!PRESETS.includes(id)) return fail(400, { error: 'errors.generic', text: null, line: null });
		// Il calendario pronto viene solo mostrato nel modulo: si salva con "Salva".
		return { text: toText(preset(id, locals.locale)), ok: 'calendar.presetLoaded' };
	}
};
