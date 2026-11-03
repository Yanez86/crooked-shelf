import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { activeInvites, apiTokenAccess, apiTokenClients, createApiToken, createInvite, revokeApiToken, revokeInvite } from '#lib/server/auth.ts';
import { getDb, schema } from '#lib/server/db/index.ts';
import { AS_PLAYER_COOKIE, deleteCampaign, membersOf, removeMember, saveCampaign, setCampaignCookie } from '#lib/server/campaigns.ts';
import { safeNext, str } from '#lib/server/forms.ts';
import { setSheetTemplate, sheetsByPlayer, sheetTemplateChoice } from '#lib/server/sheets.ts';
import { webLink } from '#lib/schedule.ts';
import { eq } from 'drizzle-orm';

const { users } = schema;

/** La campagna della richiesta, se chi scrive è il suo Master (o l'Admin). */
function mine(locals: App.Locals) {
	if (!locals.campaign || !isMaster(locals.user)) error(404, 'Not found');
	return { campaign: locals.campaign, me: locals.user! };
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.campaign) return { campaign: null, master: null, players: [], invites: [], sheets: null, claude: null };
	const { campaign, me } = mine(locals);
	// La scheda di ogni giocatore, per aprirla dalla tabella.
	const sheets = sheetsByPlayer();
	return {
		campaign: { id: campaign.id, name: campaign.name, remoteLink: campaign.remoteLink, minPlayers: campaign.minPlayers, quorumHours: campaign.quorumHours },
		master: campaign.masterId ? (getDb().select({ n: users.displayName }).from(users).where(eq(users.id, campaign.masterId)).get()?.n ?? null) : null,
		players: membersOf(campaign.id).map((p) => ({ ...p, sheet: sheets.get(p.id)?.slug ?? null })),
		invites: activeInvites(campaign.id),
		sheets: sheetTemplateChoice(me),
		// Claude lavora su una campagna solo per il suo Master (vedi hooks.server.ts): un connettore per campagna.
		claude: {
			connector: `${url.origin}/mcp/${campaign.id}`,
			access: apiTokenAccess(me.id, campaign.id),
			clients: apiTokenClients(me.id, campaign.id)
		}
	};
};

export const actions: Actions = {
	switch: async ({ request, cookies, url, locals }) => {
		const id = Number((await request.formData()).get('id'));
		if (locals.campaigns.some((c) => c.id === id)) setCampaignCookie(cookies, url, id);
		redirect(303, '/');
	},
	// Si torna alla pagina da cui si è partiti, per vederla subito nell'altra vista.
	asPlayer: async ({ request, cookies, url, locals }) => {
		const next = safeNext(str(await request.formData(), 'next'));
		if (isMaster(locals.user)) cookies.set(AS_PLAYER_COOKIE, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
		redirect(303, next);
	},
	asMaster: async ({ request, cookies }) => {
		const next = safeNext(str(await request.formData(), 'next'));
		cookies.delete(AS_PLAYER_COOKIE, { path: '/' });
		redirect(303, next);
	},
	// Ogni esito dice in quale scheda della pagina si mostra (`section`), accanto al modulo che l'ha prodotto.
	// Il template delle schede che nasceranno: quelle che ci sono già restano come sono.
	sheetTemplate: async ({ request, locals }) => {
		const { me } = mine(locals);
		if (!setSheetTemplate(str(await request.formData(), 'template', 120), me)) return fail(400, { section: 'sheets', error: 'errors.generic' });
		return { section: 'sheets', ok: 'sheets.templateSaved' };
	},
	// Appuntamenti: il link per il remoto e la regola del minimo.
	schedule: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		const f = await request.formData();
		const link = str(f, 'remoteLink', 500);
		const minPlayers = Number(f.get('minPlayers'));
		const quorumHours = Number(f.get('quorumHours'));
		if (link && !webLink(link)) return fail(400, { section: 'schedule', error: 'schedule.badLink' });
		if (!Number.isInteger(minPlayers) || minPlayers < 0 || minPlayers > 50 || !Number.isInteger(quorumHours) || quorumHours < 0 || quorumHours > 336)
			return fail(400, { section: 'schedule', error: 'errors.generic' });
		saveCampaign(campaign.id, { remoteLink: link ? webLink(link) : null, minPlayers, quorumHours });
		return { section: 'schedule', ok: 'common.saved' };
	},
	rename: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		const name = str(await request.formData(), 'name', 80);
		if (!name) return fail(400, { section: 'general', error: 'errors.nameRequired' });
		saveCampaign(campaign.id, { name });
		return { section: 'general', ok: 'common.saved' };
	},
	create: async ({ request, locals, url }) => {
		const { campaign, me } = mine(locals);
		const days = Number((await request.formData()).get('days'));
		if (![1, 7, 30].includes(days)) return fail(400, { section: 'players', error: 'errors.generic' });
		return { section: 'players', link: `${url.origin}/invite/${createInvite('player', me.id, days, campaign.id)}`, role: 'player' as const };
	},
	revoke: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		revokeInvite(Number((await request.formData()).get('id')), campaign.id);
		return { section: 'players', ok: 'admin.inviteRevoked' };
	},
	remove: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		removeMember(campaign.id, Number((await request.formData()).get('id')));
		return { section: 'players', ok: 'campaign.removed' };
	},
	// La campagna è quella della richiesta, mai un id scritto nel modulo: il Master elimina solo la sua.
	delete: async ({ request, locals }) => {
		const { campaign } = mine(locals);
		if (str(await request.formData(), 'confirm', 80) !== campaign.name) return fail(400, { section: 'general', error: 'campaign.deleteMismatch' });
		deleteCampaign(campaign.id);
		redirect(303, '/');
	},
	// Il token per il plugin di Claude Code: si vede una volta sola e sostituisce quello di prima.
	claude: async ({ request, locals, url }) => {
		const { campaign, me } = mine(locals);
		const write = (await request.formData()).get('write') === 'on';
		return { section: 'claude', token: createApiToken(me.id, campaign.id, write), url: `${url.origin}/mcp` };
	},
	// Chiude tutto: il token del plugin e i connettori.
	claudeRevoke: async ({ locals }) => {
		const { campaign, me } = mine(locals);
		revokeApiToken(me.id, campaign.id);
		return { section: 'claude', ok: 'claude.revoked' };
	}
};
