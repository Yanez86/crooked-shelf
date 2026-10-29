import { fail } from '@sveltejs/kit';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '#lib/server/db/index.ts';
import { createInvite } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { ROLES, type Role } from '#lib/roles.ts';

const { invites, users } = schema;

export const load: PageServerLoad = () => ({
	invites: getDb()
		.select({
			id: invites.id,
			role: invites.role,
			createdAt: invites.createdAt,
			expiresAt: invites.expiresAt,
			by: users.displayName
		})
		.from(invites)
		.leftJoin(users, eq(users.id, invites.createdBy))
		.where(and(isNull(invites.usedAt), gt(invites.expiresAt, Date.now())))
		.orderBy(desc(invites.createdAt))
		.all(),
	roles: [...ROLES]
});

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const role = String(f.get('role')) as Role;
		const days = Number(f.get('days'));
		if (!ROLES.includes(role) || ![1, 7, 30].includes(days)) return fail(400, { error: 'errors.generic' });
		const token = createInvite(role, me.id, days);
		return { link: `${url.origin}/invite/${token}`, role };
	},
	revoke: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const id = Number((await request.formData()).get('id'));
		getDb().delete(invites).where(and(eq(invites.id, id), isNull(invites.usedAt))).run();
		return { ok: 'admin.inviteRevoked' };
	}
};
