import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AS_PLAYER_COOKIE, campaignAllowance, setCampaignCookie } from '#lib/server/campaigns.ts';
import { newCampaign } from '#lib/server/templates.ts';
import { audit } from '#lib/server/audit.ts';
import { str } from '#lib/server/forms.ts';

/**
 * Una campagna nuova la crea l'account, qualunque ruolo abbia nella campagna in cui si trova (anche da giocatore),
 * e ne diventa il Master. Fino al suo tetto (vedi campaignAllowance): oltre, gliene dà l'Admin.
 */
function account(locals: App.Locals) {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent('/campaign/new')}`);
	return locals.user;
}

export const load: PageServerLoad = ({ locals }) => campaignAllowance(account(locals).id);

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
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
