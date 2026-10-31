import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { activeInvites, createInvite, revokeInvite } from '#lib/server/auth.ts';
import { getDb, schema } from '#lib/server/db/index.ts';
import { deleteCampaign, membersOf, removeMember, saveCampaign, setCampaignCookie } from '#lib/server/campaigns.ts';
import { str } from '#lib/server/forms.ts';
import { eq } from 'drizzle-orm';

const { users } = schema;

/** La campagna della richiesta, se chi scrive è il suo Master (o l'Admin). */
function mine(locals: App.Locals) {
	if (!locals.campaign || !isMaster(locals.user)) error(404, 'Not found');
	return { campaign: locals.campaign, me: locals.user! };
}

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.campaign) return { campaign: null, master: null, players: [], invites: [] };
	const { campaign } = mine(locals);
	return {
		campaign: { id: campaign.id, name: campaign.name },
		master: campaign.masterId ? (getDb().select({ n: users.displayName }).from(users).where(eq(users.id, campaign.masterId)).get()?.n ?? null) : null,
		players: membersOf(campaign.id),
		invites: activeInvites(campaign.id)
	};
};

export const actions: Actions = {
	switch: async ({ request, cookies, url, locals }) => {
		const id = Number((await request.formData()).get('id'));
		if (locals.campaigns.some((c) => c.id === id)) setCampaignCookie(cookies, url, id);
		redirect(303, '/');
	},
	rename: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		const name = str(await request.formData(), 'name', 80);
		if (!name) return fail(400, { error: 'errors.nameRequired' });
		saveCampaign(campaign.id, { name });
		return { ok: 'common.saved' };
	},
	create: async ({ request, locals, url }) => {
		const { campaign, me } = mine(locals);
		const days = Number((await request.formData()).get('days'));
		if (![1, 7, 30].includes(days)) return fail(400, { error: 'errors.generic' });
		return { link: `${url.origin}/invite/${createInvite('player', me.id, days, campaign.id)}`, role: 'player' as const };
	},
	revoke: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		revokeInvite(Number((await request.formData()).get('id')), campaign.id);
		return { ok: 'admin.inviteRevoked' };
	},
	remove: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		removeMember(campaign.id, Number((await request.formData()).get('id')));
		return { ok: 'campaign.removed' };
	},
	// La campagna è quella della richiesta, mai un id scritto nel modulo: il Master elimina solo la sua.
	delete: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		if (str(await request.formData(), 'confirm', 80) !== campaign.name) return fail(400, { error: 'campaign.deleteMismatch' });
		deleteCampaign(campaign.id);
		redirect(303, '/');
	}
};
