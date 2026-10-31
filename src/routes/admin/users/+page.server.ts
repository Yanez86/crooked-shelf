import { fail } from '@sveltejs/kit';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '#lib/server/db/index.ts';
import { deleteUserSessions } from '#lib/server/auth.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { ROLES, type Role } from '#lib/roles.ts';

const { users } = schema;

export const load: PageServerLoad = () => ({
	users: getDb()
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			icon: users.icon,
			role: users.role,
			disabled: users.disabled,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(asc(users.username))
		.all(),
	roles: [...ROLES]
});

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
		const target = getDb().select().from(users).where(eq(users.id, id)).get();
		if (!target || !ROLES.includes(role)) return fail(400, { error: 'errors.generic' });
		if (id === me.id && (role !== 'admin' || disabled)) return fail(400, { error: 'errors.selfDemote' });
		if (target.role === 'admin' && (role !== 'admin' || disabled) && otherAdmins(id) === 0)
			return fail(400, { error: 'errors.lastAdmin' });
		getDb().update(users).set({ role, disabled }).where(eq(users.id, id)).run();
		if (disabled) deleteUserSessions(id);
		return { ok: 'common.saved' };
	}
};
