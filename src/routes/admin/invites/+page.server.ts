import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { activeInvites, createInvite, revokeInvite } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { audit } from '#lib/server/audit.ts';
import { ROLES, type Role } from '#lib/roles.ts';

export const load: PageServerLoad = () => ({ invites: activeInvites(), roles: [...ROLES] });

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const role = String(f.get('role')) as Role;
		const days = Number(f.get('days'));
		if (!ROLES.includes(role) || ![1, 7, 30].includes(days)) return fail(400, { error: 'errors.generic' });
		// Un giocatore entra nella campagna in cui si è ora; Master e Admin ricevono le campagne da qui, in Amministrazione.
		const token = createInvite(role, me.id, days, role === 'player' ? (locals.campaign?.id ?? null) : null);
		audit('invite_created', { userId: me.id, ip: locals.ip }, role);
		return { link: `${url.origin}/invite/${token}`, role };
	},
	revoke: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		revokeInvite(Number((await request.formData()).get('id')));
		audit('invite_revoked', { userId: me.id, ip: locals.ip });
		return { ok: 'admin.inviteRevoked' };
	}
};
