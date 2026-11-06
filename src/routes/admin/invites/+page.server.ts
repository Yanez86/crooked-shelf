import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { activeInvites, createInvite, revokeInvite } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { audit } from '#lib/server/audit.ts';

// L'invito crea un account; se l'Admin vuole, lo fa entrare come giocatore nella campagna in cui si trova.
export const load: PageServerLoad = ({ locals }) => ({ invites: activeInvites(), campaign: locals.campaign?.name ?? null });

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const where = String(f.get('where') ?? 'none');
		const days = Number(f.get('days'));
		if (!['campaign', 'none'].includes(where) || ![1, 7, 30].includes(days)) return fail(400, { error: 'errors.generic' });
		const campaign = where === 'campaign' ? locals.campaign : null;
		const token = createInvite(me.id, days, campaign?.id ?? null);
		audit('invite_created', { userId: me.id, ip: locals.ip }, campaign ? `player ${campaign.name}` : 'account');
		return { link: `${url.origin}/invite/${token}`, campaign: campaign?.name ?? null };
	},
	revoke: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		revokeInvite(Number((await request.formData()).get('id')));
		audit('invite_revoked', { userId: me.id, ip: locals.ip });
		return { ok: 'admin.inviteRevoked' };
	}
};
