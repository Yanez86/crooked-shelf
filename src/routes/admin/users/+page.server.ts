import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '#lib/server/db/index.ts';
import { createPasswordReset, deleteUserSessions } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { MAX_CAMPAIGN_LIMIT, campaignsHeld } from '#lib/server/campaigns.ts';

const { users } = schema;

/**
 * Gli account non hanno ruoli da scegliere: Master e giocatori si è nelle campagne (vedi roleIn), e l'Admin è uno solo.
 * Qui l'Admin cambia il limite di campagne, disattiva, manda il link per la password e passa l'amministrazione.
 */
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
			.map(({ role, ...u }) => ({ ...u, admin: role === 'admin', held: held.get(u.id) ?? 0 })),
		maxCampaigns: MAX_CAMPAIGN_LIMIT
	};
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const id = Number(f.get('id'));
		const disabled = f.get('disabled') === 'on';
		const raw = f.get('campaignLimit');
		const target = getDb().select().from(users).where(eq(users.id, id)).get();
		if (!target) return fail(400, { error: 'errors.generic' });
		// Le campagne che può creare da sé: senza il campo (un modulo aperto prima di questa versione) resta il tetto che aveva.
		const campaignLimit = raw === null ? target.campaignLimit : /^\d{1,3}$/.test(String(raw).trim()) ? Number(String(raw).trim()) : NaN;
		if (!(campaignLimit >= 0 && campaignLimit <= MAX_CAMPAIGN_LIMIT)) return fail(400, { error: 'admin.badCampaignLimit', params: { max: MAX_CAMPAIGN_LIMIT } });
		// L'Admin è uno solo: disattivato, il sito resterebbe senza. Prima passa l'amministrazione a un altro.
		if (disabled && (id === me.id || target.role === 'admin')) return fail(400, { error: 'errors.selfDisable' });
		getDb().update(users).set({ disabled, campaignLimit }).where(eq(users.id, id)).run();
		if (disabled) deleteUserSessions(id);
		audit('user_updated', { userId: me.id, ip: locals.ip }, `${target.username}: ${disabled ? 'disabled' : 'active'}, campaigns ${campaignLimit}`);
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
	},
	/**
	 * L'Admin passa l'amministrazione a un altro account attivo e ne diventa uno normale: tiene le sue campagne e le sue pagine.
	 * Prima toglie sé, poi nomina l'altro, nella stessa transazione: l'indice users_one_admin non ne vuole due.
	 */
	transfer: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const target = getDb().select().from(users).where(eq(users.id, Number(f.get('id')))).get();
		if (!target || target.id === me.id || target.disabled) return fail(400, { error: 'errors.generic' });
		if (f.get('confirm') !== 'on') return fail(400, { error: 'admin.transferUnconfirmed' });
		getDb().transaction((tx) => {
			tx.update(users).set({ role: 'player' }).where(eq(users.id, me.id)).run();
			tx.update(users).set({ role: 'admin' }).where(eq(users.id, target.id)).run();
		});
		audit('admin_transferred', { userId: me.id, ip: locals.ip }, target.username);
		// Fuori dall'amministrazione, che ora non è più sua.
		redirect(303, '/');
	}
};
