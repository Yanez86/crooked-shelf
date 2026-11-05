import { fail } from '@sveltejs/kit';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '#lib/server/db/index.ts';
import { createPasswordReset, deleteUserSessions } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { ROLES, type Role } from '#lib/roles.ts';
import { MAX_CAMPAIGN_LIMIT, campaignsHeld } from '#lib/server/campaigns.ts';

const { users } = schema;

export const load: PageServerLoad = () => {
	const held = campaignsHeld();
	return {
		users: getDb()
			.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			icon: users.icon,
			avatar: users.avatar,
			role: users.role,
			disabled: users.disabled,
			createdAt: users.createdAt,
			campaignLimit: users.campaignLimit
		})
		.from(users)
		.orderBy(asc(users.username))
		.all()
		// Le campagne che tiene accanto al tetto: si vede subito chi l'ha raggiunto.
		.map((u) => ({ ...u, held: held.get(u.id) ?? 0 })),
		roles: [...ROLES],
		maxCampaigns: MAX_CAMPAIGN_LIMIT
	};
};

/** Deve restare almeno un amministratore attivo. */
function otherAdmins(id: number) {
	return (
		getDb()
			.select({ n: sql<number>`count(*)` })
			.from(users)
			.where(and(eq(users.role, 'admin'), eq(users.disabled, false), ne(users.id, id)))
			.get()?.n ?? 0
	);
}

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const id = Number(f.get('id'));
		const role = String(f.get('role')) as Role;
		const disabled = f.get('disabled') === 'on';
		const raw = f.get('campaignLimit');
		const target = getDb().select().from(users).where(eq(users.id, id)).get();
		if (!target || !ROLES.includes(role)) return fail(400, { error: 'errors.generic' });
		// Le campagne che può creare da sé: senza il campo (un modulo aperto prima di questa versione) resta il tetto che aveva.
		const campaignLimit = raw === null ? target.campaignLimit : /^\d{1,3}$/.test(String(raw).trim()) ? Number(String(raw).trim()) : NaN;
		if (!(campaignLimit >= 0 && campaignLimit <= MAX_CAMPAIGN_LIMIT)) return fail(400, { error: 'admin.badCampaignLimit', params: { max: MAX_CAMPAIGN_LIMIT } });
		if (id === me.id && (role !== 'admin' || disabled)) return fail(400, { error: 'errors.selfDemote' });
		if (target.role === 'admin' && (role !== 'admin' || disabled) && otherAdmins(id) === 0)
			return fail(400, { error: 'errors.lastAdmin' });
		getDb().update(users).set({ role, disabled, campaignLimit }).where(eq(users.id, id)).run();
		if (disabled) deleteUserSessions(id);
		audit('user_updated', { userId: me.id, ip: locals.ip }, `${target.username}: ${role}${disabled ? ', disabled' : ''}, campaigns ${campaignLimit}`);
		return { ok: 'common.saved' };
	},
	// Chi ha dimenticato la password: un link da mandargli, che vale due giorni e una volta sola.
	reset: async ({ request, locals, url }) => {
		const me = requireAdmin(locals.user);
		const id = Number((await request.formData()).get('id'));
		const target = getDb().select({ id: users.id, username: users.username, disabled: users.disabled }).from(users).where(eq(users.id, id)).get();
		if (!target || target.disabled) return fail(400, { error: 'errors.generic' });
		audit('password_reset_link', { userId: me.id, ip: locals.ip }, target.username);
		return { resetLink: `${url.origin}/reset/${createPasswordReset(target.id, me.id)}`, resetFor: target.username };
	}
};
