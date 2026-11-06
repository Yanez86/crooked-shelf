import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { audit } from '#lib/server/audit.ts';
import { AS_PLAYER_COOKIE, campaignAllowance, masterOf, setCampaignCookie } from '#lib/server/campaigns.ts';
import { newCampaign } from '#lib/server/templates.ts';
import { safeNext, str } from '#lib/server/forms.ts';

/** Il pannello è dell'account: chi non ha fatto l'accesso va prima ad accedere. */
function account(locals: App.Locals) {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent('/campaign')}`);
	return locals.user;
}

// Qui le proprie campagne e una nuova; le opzioni di ciascuna sono in /campaign/<id>, solo per il Master.
export const load: PageServerLoad = ({ locals }) => {
	const u = account(locals);
	return {
		campaigns: locals.campaigns.map((c) => ({
			id: c.id,
			name: c.name,
			mine: c.masterId === u.id,
			current: c.id === locals.campaign?.id,
			master: masterOf(c)?.name ?? null
		})),
		allowance: campaignAllowance(u.id)
	};
};

export const actions: Actions = {
	switch: async ({ request, cookies, url, locals }) => {
		const id = Number((await request.formData()).get('id'));
		if (locals.campaigns.some((c) => c.id === id)) setCampaignCookie(cookies, url, id);
		redirect(303, '/');
	},
	// Si torna alla pagina da cui si è partiti, per vederla subito nell'altra vista.
	asPlayer: async ({ request, cookies, url, locals }) => {
		const next = safeNext(str(await request.formData(), 'next'));
		if (isMaster(locals.user)) cookies.set(AS_PLAYER_COOKIE, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
		redirect(303, next);
	},
	asMaster: async ({ request, cookies }) => {
		const next = safeNext(str(await request.formData(), 'next'));
		cookies.delete(AS_PLAYER_COOKIE, { path: '/' });
		redirect(303, next);
	},
	/**
	 * Una campagna nuova la crea l'account, qualunque ruolo abbia nella campagna in cui si trova (anche da giocatore),
	 * e ne diventa il Master. Fino al suo tetto (vedi campaignAllowance): oltre, gliene dà l'Admin.
	 */
	newCampaign: async ({ request, locals, cookies, url }) => {
		const u = account(locals);
		const name = str(await request.formData(), 'name', 80);
		if (!name) return fail(400, { error: 'errors.nameRequired', name });
		if (!campaignAllowance(u.id).canCreate) return fail(403, { error: 'campaign.limitReached', name });
		const c = newCampaign(name, { id: u.id, role: 'master' }, locals.locale);
		audit('campaign_created', { userId: u.id, ip: locals.ip }, name);
		// Si entra nella campagna appena creata, con la propria vista: lì si è Master.
		setCampaignCookie(cookies, url, c.id);
		cookies.delete(AS_PLAYER_COOKIE, { path: '/' });
		redirect(303, '/');
	}
};
