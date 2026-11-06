import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { apiTokenAccess, apiTokenClients, apiTokenInfo, activeInvites, createApiToken, createInvite, revokeApiToken, revokeInvite } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import { deleteCampaign, getCampaign, inCampaign, membersOf, removeMember, saveCampaign } from '#lib/server/campaigns.ts';
import { str } from '#lib/server/forms.ts';
import { setSheetTemplate, sheetsByPlayer, sheetTemplateChoice } from '#lib/server/sheets.ts';
import { webLink } from '#lib/schedule.ts';

/**
 * La campagna dell'indirizzo, solo se chi scrive ne è il Master, e non nella vista giocatore.
 * La si gestisce anche senza esserci dentro: il ruolo della richiesta vale per l'altra, qui si è il Master di questa.
 */
function mine(locals: App.Locals, params: { id: string }) {
	const id = Number(params.id);
	// Riletta: dopo un salvataggio, la pagina mostra la campagna com'è ora, non com'era all'inizio della richiesta.
	const campaign = locals.campaigns.some((c) => c.id === id) ? getCampaign(id) : undefined;
	if (!campaign || !locals.user || locals.asPlayer || campaign.masterId !== locals.user.id) error(404, 'Not found');
	return { campaign, me: { ...locals.user, role: 'master' as const } };
}

/** Le opzioni del Master per la campagna; template e schede si leggono dentro quella campagna. */
export const load: PageServerLoad = ({ locals, url, params }) => {
	const { campaign, me } = mine(locals, params);
	return inCampaign(campaign, () => {
		const sheets = sheetsByPlayer();
		return {
			campaign: { id: campaign.id, name: campaign.name, remoteLink: campaign.remoteLink, minPlayers: campaign.minPlayers, quorumHours: campaign.quorumHours, starWishes: campaign.starWishes, schedule: campaign.schedule },
			current: campaign.id === locals.campaign?.id,
			// La scheda di ogni giocatore, per aprirla dalla tabella.
			players: membersOf(campaign.id).map((p) => ({ ...p, sheet: sheets.get(p.id)?.slug ?? null })),
			invites: activeInvites(campaign.id),
			sheets: sheetTemplateChoice(me),
			// Claude lavora su una campagna solo per il suo Master (vedi hooks.server.ts): un connettore per campagna.
			claude: {
				connector: `${url.origin}/mcp/${campaign.id}`,
				access: apiTokenAccess(me.id, campaign.id),
				token: apiTokenInfo(me.id, campaign.id) ?? null,
				clients: apiTokenClients(me.id, campaign.id)
			}
		};
	});
};

export const actions: Actions = {
	// Ogni esito dice in quale scheda della pagina si mostra (`section`), accanto al modulo che l'ha prodotto.
	// Il template delle schede che nasceranno: quelle che ci sono già restano come sono.
	sheetTemplate: async ({ request, locals, params }) => {
		const { campaign, me } = mine(locals, params);
		const slug = str(await request.formData(), 'template', 120);
		if (!inCampaign(campaign, () => setSheetTemplate(slug, me))) return fail(400, { section: 'sheets', error: 'errors.generic' });
		return { section: 'sheets', ok: 'sheets.templateSaved' };
	},
	// Appuntamenti: il link per il remoto, la regola del minimo e Stars & Wishes.
	schedule: async ({ request, locals, params }) => {
		const { campaign } = mine(locals, params);
		if (!campaign.schedule) return fail(400, { section: 'schedule', error: 'errors.generic' });
		const f = await request.formData();
		const link = str(f, 'remoteLink', 500);
		const minPlayers = Number(f.get('minPlayers'));
		const quorumHours = Number(f.get('quorumHours'));
		if (link && !webLink(link)) return fail(400, { section: 'schedule', error: 'schedule.badLink' });
		if (!Number.isInteger(minPlayers) || minPlayers < 0 || minPlayers > 50 || !Number.isInteger(quorumHours) || quorumHours < 0 || quorumHours > 336)
			return fail(400, { section: 'schedule', error: 'errors.generic' });
		saveCampaign(campaign.id, { remoteLink: link ? webLink(link) : null, minPlayers, quorumHours, starWishes: f.get('starWishes') === 'on' });
		return { section: 'schedule', ok: 'common.saved' };
	},
	// Le opzioni della campagna: gli appuntamenti si accendono e si spengono; spenti, i dati restano.
	features: async ({ request, locals, params }) => {
		const { campaign } = mine(locals, params);
		saveCampaign(campaign.id, { schedule: (await request.formData()).get('schedule') === 'on' });
		return { section: 'features', ok: 'common.saved' };
	},
	rename: async ({ request, locals, params }) => {
		const { campaign } = mine(locals, params);
		const name = str(await request.formData(), 'name', 80);
		if (!name) return fail(400, { section: 'general', error: 'errors.nameRequired' });
		saveCampaign(campaign.id, { name });
		return { section: 'general', ok: 'common.saved' };
	},
	create: async ({ request, locals, url, params }) => {
		const { campaign, me } = mine(locals, params);
		const days = Number((await request.formData()).get('days'));
		if (![1, 7, 30].includes(days)) return fail(400, { section: 'players', error: 'errors.generic' });
		audit('invite_created', { userId: me.id, ip: locals.ip }, `player ${campaign.name}`);
		return { section: 'players', link: `${url.origin}/invite/${createInvite('player', me.id, days, campaign.id)}`, role: 'player' as const };
	},
	revoke: async ({ request, locals, params }) => {
		const { campaign } = mine(locals, params);
		revokeInvite(Number((await request.formData()).get('id')), campaign.id);
		return { section: 'players', ok: 'admin.inviteRevoked' };
	},
	remove: async ({ request, locals, params }) => {
		const { campaign } = mine(locals, params);
		removeMember(campaign.id, Number((await request.formData()).get('id')));
		return { section: 'players', ok: 'campaign.removed' };
	},
	// La campagna è quella dell'indirizzo, controllata da mine(): il Master elimina solo le sue.
	delete: async ({ request, locals, params }) => {
		const { campaign } = mine(locals, params);
		if (str(await request.formData(), 'confirm', 80) !== campaign.name) return fail(400, { section: 'general', error: 'campaign.deleteMismatch' });
		audit('campaign_deleted', { userId: locals.user!.id, ip: locals.ip }, campaign.name);
		deleteCampaign(campaign.id);
		redirect(303, '/');
	},
	// Il token per il plugin di Claude Code: si vede una volta sola e sostituisce quello di prima.
	claude: async ({ request, locals, url, params }) => {
		const { campaign, me } = mine(locals, params);
		const write = (await request.formData()).get('write') === 'on';
		audit('token_created', { userId: me.id, ip: locals.ip }, `${write ? 'write' : 'read'} ${campaign.name}`);
		return { section: 'claude', token: createApiToken(me.id, campaign.id, write), url: `${url.origin}/mcp` };
	},
	// Chiude tutto: il token del plugin e i connettori.
	claudeRevoke: async ({ locals, params }) => {
		const { campaign, me } = mine(locals, params);
		revokeApiToken(me.id, campaign.id);
		audit('token_revoked', { userId: me.id, ip: locals.ip }, campaign.name);
		return { section: 'claude', ok: 'claude.revoked' };
	}
};
