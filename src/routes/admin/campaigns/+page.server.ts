import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '#lib/server/db/index.ts';
import { deleteCampaign, getCampaign, saveCampaign, setMaster } from '#lib/server/campaigns.ts';
import { getSettings } from '#lib/server/settings.ts';
import { newCampaign } from '#lib/server/templates.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { str } from '#lib/server/forms.ts';

const { campaigns, campaignMembers, users } = schema;

/** Chi può tenere una campagna: gli account attivi da Master o Admin, e chi ne tiene già una (per non cambiarlo di nascosto salvando il nome). */
const masters = () =>
	getDb()
		.select({ id: users.id, displayName: users.displayName, username: users.username })
		.from(users)
		.where(or(and(inArray(users.role, ['master', 'admin']), eq(users.disabled, false)), sql`${users.id} IN (SELECT ${campaigns.masterId} FROM ${campaigns})`))
		.orderBy(asc(users.displayName))
		.all();

export const load: PageServerLoad = () => ({
	campaigns: getDb()
		.select({
			id: campaigns.id,
			name: campaigns.name,
			masterId: campaigns.masterId,
			players: sql<number>`(SELECT count(*) FROM ${campaignMembers} WHERE ${campaignMembers.campaignId} = ${campaigns.id})`
		})
		.from(campaigns)
		.orderBy(asc(campaigns.id))
		.all(),
	masters: masters()
});

/** Nome e Master letti dal modulo; `error` se uno dei due non va bene. */
function read(f: FormData) {
	const name = str(f, 'name', 80);
	const masterId = Number(f.get('masterId'));
	if (!name) return { error: 'errors.nameRequired' };
	if (!masters().some((m) => m.id === masterId)) return { error: 'errors.generic' };
	return { name, masterId };
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const r = read(await request.formData());
		if ('error' in r) return fail(400, { error: r.error });
		newCampaign(r.name, { id: r.masterId, role: 'master' }, getSettings().defaultLocale);
		return { ok: 'admin.campaignCreated' };
	},
	update: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const f = await request.formData();
		const id = Number(f.get('id'));
		const r = read(f);
		if ('error' in r) return fail(400, { error: r.error });
		saveCampaign(id, { name: r.name });
		setMaster(id, r.masterId);
		return { ok: 'common.saved' };
	},
	delete: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const f = await request.formData();
		const c = getCampaign(Number(f.get('id')));
		if (!c) return fail(404, { error: 'errors.generic' });
		if (str(f, 'confirm', 80) !== c.name) return fail(400, { error: 'campaign.deleteMismatch' });
		deleteCampaign(c.id);
		// Una richiesta nuova: questa potrebbe stare proprio nella campagna appena eliminata.
		redirect(303, '/admin/campaigns?deleted=1');
	}
};
