import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { isMember } from '#lib/server/campaigns.ts';
import { str } from '#lib/server/forms.ts';
import { monthSchedule, monthStarWishes, saveStarWish, setAnswer, skipDate } from '#lib/server/schedule.ts';
import { ANSWERS, DATE_RE, localDate, MONTH_RE, shiftMonth, type Answer } from '#lib/schedule.ts';

/** Gli appuntamenti sono del tavolo: il Master e i giocatori della campagna, non i visitatori (c'è il link del remoto). */
function table(locals: App.Locals) {
	if (!locals.user || !locals.campaign) error(404, 'Not found');
	return { campaign: locals.campaign, me: locals.user };
}

export const load: PageServerLoad = ({ locals, url }) => {
	const { campaign, me } = table(locals);
	const m = url.searchParams.get('m') ?? '';
	const month = MONTH_RE.test(m) ? m : localDate().slice(0, 7);
	return {
		month,
		prev: shiftMonth(month, -1),
		next: shiftMonth(month, 1),
		today: localDate(),
		items: monthSchedule(month),
		rule: { min: campaign.minPlayers, hours: campaign.quorumHours },
		canManage: isMaster(me),
		canAnswer: isMember(campaign.id, me.id),
		// Stars & Wishes: le risposte dei giocatori sono per il Master, e spariscono con la funzione spenta.
		starWishes: isMaster(me) && campaign.starWishes ? monthStarWishes(month) : {}
	};
};

export const actions: Actions = {
	answer: async ({ request, locals }) => {
		const { campaign, me } = table(locals);
		const f = await request.formData();
		const answer = str(f, 'answer') as Answer;
		const date = str(f, 'date', 10);
		if (!isMember(campaign.id, me.id)) return fail(403, { error: 'errors.forbidden' });
		if (!ANSWERS.includes(answer) || !DATE_RE.test(date) || !setAnswer(Number(f.get('id')), date, me.id, answer)) return fail(400, { error: 'errors.generic' });
		return { ok: 'schedule.answered' };
	},
	// Stars & Wishes, dal popup che compare entrando nella campagna (vedi +layout.server.ts): la sessione la sceglie il server.
	starWish: async ({ request, locals }) => {
		const { me } = table(locals);
		const f = await request.formData();
		const star = str(f, 'star', 2000);
		const wish = str(f, 'wish', 2000);
		if (!star && !wish) return fail(400, { starWishError: 'schedule.starWishes.empty' });
		if (!saveStarWish(me.id, star, wish)) return fail(400, { starWishError: 'schedule.starWishes.closed' });
		return { starWishOk: true };
	},
	skip: async ({ request, locals }) => {
		const { me } = table(locals);
		if (!isMaster(me)) return fail(403, { error: 'errors.forbidden' });
		const f = await request.formData();
		const date = str(f, 'date', 10);
		if (!DATE_RE.test(date)) return fail(400, { error: 'errors.generic' });
		skipDate(Number(f.get('id')), date);
		return { ok: 'schedule.skipped' };
	}
};
