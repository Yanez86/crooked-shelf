import { fail, redirect } from '@sveltejs/kit';
import { asc, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb, schema } from '#lib/server/db/index.ts';
import { canAppoint, deleteCampaign, getCampaign, masterCandidates, saveCampaign, setMaster } from '#lib/server/campaigns.ts';
import { getSettings } from '#lib/server/settings.ts';
import { newCampaign } from '#lib/server/templates.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { audit } from '#lib/server/audit.ts';
import { str } from '#lib/server/forms.ts';

const { campaigns, campaignMembers } = schema;

export const load: PageServerLoad = ({ locals }) => ({
	me: locals.user?.id ?? null,
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
	masters: masterCandidates()
});

/** Nome e Master letti dal modulo; `error` se uno dei due non va bene. */
function read(f: FormData) {
	const name = str(f, 'name', 80);
	const masterId = Number(f.get('masterId'));
	if (!name) return { error: 'errors.nameRequired' };
	if (!masterCandidates().some((m) => m.id === masterId)) return { error: 'errors.generic' };
	return { name, masterId };
}

export const actions: Actions = {
	// Anche oltre il limite di chi la terrà: quello vale per le campagne che si creano da sé (/campaign/new).
	create: async ({ request, locals }) => {
		const u = requireAdmin(locals.user);
		const r = read(await request.formData());
		if ('error' in r) return fail(400, { error: r.error });
		newCampaign(r.name, { id: r.masterId, role: 'master' }, getSettings().defaultLocale);
		audit('campaign_created', { userId: u.id, ip: locals.ip }, `${r.name}: ${r.masterId}`);
		return { ok: 'admin.campaignCreated' };
	},
	update: async ({ request, locals }) => {
		const u = requireAdmin(locals.user);
		const f = await request.formData();
		const c = getCampaign(Number(f.get('id')));
		if (!c) return fail(404, { error: 'errors.generic' });
		const r = read(f);
		if ('error' in r) return fail(400, { error: r.error });
		if (!canAppoint(c, r.masterId, u)) return fail(403, { error: 'admin.selfAppoint' });
		saveCampaign(c.id, { name: r.name });
		if (c.masterId !== r.masterId) audit('campaign_master', { userId: u.id, ip: locals.ip }, `${r.name}: ${r.masterId}`);
		setMaster(c.id, r.masterId);
		return { ok: 'common.saved' };
	},
	delete: async ({ request, locals }) => {
		const u = requireAdmin(locals.user);
		const f = await request.formData();
		const c = getCampaign(Number(f.get('id')));
		if (!c) return fail(404, { error: 'errors.generic' });
		if (str(f, 'confirm', 80) !== c.name) return fail(400, { error: 'campaign.deleteMismatch' });
		audit('campaign_deleted', { userId: u.id, ip: locals.ip }, c.name);
		deleteCampaign(c.id);
		// Una richiesta nuova: questa potrebbe stare proprio nella campagna appena eliminata.
		redirect(303, '/admin/campaigns?deleted=1');
	}
};
