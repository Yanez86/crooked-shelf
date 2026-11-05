import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { activeInvites, apiTokenAccess, apiTokenClients, apiTokenInfo, createApiToken, createInvite, revokeApiToken, revokeInvite } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import { AS_PLAYER_COOKIE, campaignAllowance, deleteCampaign, getCampaign, inCampaign, masterOf, membersOf, removeMember, saveCampaign, setCampaignCookie } from '#lib/server/campaigns.ts';
import { newCampaign } from '#lib/server/templates.ts';
import { safeNext, str } from '#lib/server/forms.ts';
import { setSheetTemplate, sheetsByPlayer, sheetTemplateChoice } from '#lib/server/sheets.ts';
import { webLink } from '#lib/schedule.ts';

/** Il pannello è dell'account: chi non ha fatto l'accesso va prima ad accedere. */
function account(locals: App.Locals) {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent('/campaign')}`);
	return locals.user;
}

/**
 * La campagna da gestire: quella dell'indirizzo (?id=…), se no quella in cui si è. Solo se chi scrive ne è il Master,
 * e non nella vista giocatore. Il ruolo della richiesta vale per la campagna in cui si è: qui si è il Master di questa.
 */
function mine(locals: App.Locals, url: URL) {
	const id = Number(url.searchParams.get('id')) || locals.campaign?.id;
	// Riletta: dopo un salvataggio, la pagina mostra la campagna com'è ora, non com'era all'inizio della richiesta.
	const campaign = locals.campaigns.some((c) => c.id === id) ? getCampaign(id!) : undefined;
	if (!campaign || !locals.user || locals.asPlayer || campaign.masterId !== locals.user.id) error(404, 'Not found');
	return { campaign, me: { ...locals.user, role: 'master' as const } };
}

/** Le opzioni del Master per la campagna che gestisce; template e schede si leggono dentro quella campagna. */
function manage(locals: App.Locals, url: URL) {
	const { campaign, me } = mine(locals, url);
	return inCampaign(campaign, () => {
		const sheets = sheetsByPlayer();
		return {
			campaign: { id: campaign.id, name: campaign.name, remoteLink: campaign.remoteLink, minPlayers: campaign.minPlayers, quorumHours: campaign.quorumHours, starWishes: campaign.starWishes, schedule: campaign.schedule },
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
}

// Le schede del Master; le altre (le proprie campagne, una nuova) sono di ogni account.
const MASTER_TABS = ['general', 'players', 'schedule', 'claude'];

export const load: PageServerLoad = ({ locals, url }) => {
	const u = account(locals);
	const asked = url.searchParams.get('tab') ?? '';
	// Senza ?id= si gestisce la campagna in cui si è, se è propria; una scheda del Master chiesta da chi non lo è non c'è.
	const own = !!locals.campaign && locals.campaign.masterId === u.id && !locals.asPlayer;
	const managed = MASTER_TABS.includes(asked) || url.searchParams.has('id') || own ? manage(locals, url) : null;
	return {
		campaigns: locals.campaigns.map((c) => ({
			id: c.id,
			name: c.name,
			mine: c.masterId === u.id,
			current: c.id === locals.campaign?.id,
			master: masterOf(c)?.name ?? null
		})),
		allowance: campaignAllowance(u.id),
		managed
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
	/**
	 * Una campagna nuova la crea l'account, qualunque ruolo abbia nella campagna in cui si trova (anche da giocatore),
	 * e ne diventa il Master. Fino al suo tetto (vedi campaignAllowance): oltre, gliene dà l'Admin.
	 */
	newCampaign: async ({ request, locals, cookies, url }) => {
		const u = account(locals);
		const name = str(await request.formData(), 'name', 80);
		if (!name) return fail(400, { section: 'new', error: 'errors.nameRequired', name });
		if (!campaignAllowance(u.id).canCreate) return fail(403, { section: 'new', error: 'campaign.limitReached', name });
		const c = newCampaign(name, { id: u.id, role: 'master' }, locals.locale);
		audit('campaign_created', { userId: u.id, ip: locals.ip }, name);
		// Si entra nella campagna appena creata, con la propria vista: lì si è Master.
		setCampaignCookie(cookies, url, c.id);
		cookies.delete(AS_PLAYER_COOKIE, { path: '/' });
		redirect(303, '/');
	},
	// Ogni esito dice in quale scheda della pagina si mostra (`section`), accanto al modulo che l'ha prodotto.
	// Il template delle schede che nasceranno: quelle che ci sono già restano come sono.
	sheetTemplate: async ({ request, locals, url }) => {
		const { campaign, me } = mine(locals, url);
		const slug = str(await request.formData(), 'template', 120);
		if (!inCampaign(campaign, () => setSheetTemplate(slug, me))) return fail(400, { section: 'sheets', error: 'errors.generic' });
		return { section: 'sheets', ok: 'sheets.templateSaved' };
	},
	// Appuntamenti: il link per il remoto, la regola del minimo e Stars & Wishes.
	schedule: async ({ request, locals, url }) => {
		const { campaign } = mine(locals, url);
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
	features: async ({ request, locals, url }) => {
		const { campaign } = mine(locals, url);
		saveCampaign(campaign.id, { schedule: (await request.formData()).get('schedule') === 'on' });
		return { section: 'features', ok: 'common.saved' };
	},
	rename: async ({ request, locals, url }) => {
		const { campaign } = mine(locals, url);
		const name = str(await request.formData(), 'name', 80);
		if (!name) return fail(400, { section: 'general', error: 'errors.nameRequired' });
		saveCampaign(campaign.id, { name });
		return { section: 'general', ok: 'common.saved' };
	},
	create: async ({ request, locals, url }) => {
		const { campaign, me } = mine(locals, url);
		const days = Number((await request.formData()).get('days'));
		if (![1, 7, 30].includes(days)) return fail(400, { section: 'players', error: 'errors.generic' });
		audit('invite_created', { userId: me.id, ip: locals.ip }, `player ${campaign.name}`);
		return { section: 'players', link: `${url.origin}/invite/${createInvite('player', me.id, days, campaign.id)}`, role: 'player' as const };
	},
	revoke: async ({ request, locals, url }) => {
		const { campaign } = mine(locals, url);
		revokeInvite(Number((await request.formData()).get('id')), campaign.id);
		return { section: 'players', ok: 'admin.inviteRevoked' };
	},
	remove: async ({ request, locals, url }) => {
		const { campaign } = mine(locals, url);
		removeMember(campaign.id, Number((await request.formData()).get('id')));
		return { section: 'players', ok: 'campaign.removed' };
	},
	// La campagna è quella dell'indirizzo, controllata da mine(): il Master elimina solo le sue.
	delete: async ({ request, locals, url }) => {
		const { campaign } = mine(locals, url);
		if (str(await request.formData(), 'confirm', 80) !== campaign.name) return fail(400, { section: 'general', error: 'campaign.deleteMismatch' });
		audit('campaign_deleted', { userId: locals.user!.id, ip: locals.ip }, campaign.name);
		deleteCampaign(campaign.id);
		redirect(303, '/');
	},
	// Il token per il plugin di Claude Code: si vede una volta sola e sostituisce quello di prima.
	claude: async ({ request, locals, url }) => {
		const { campaign, me } = mine(locals, url);
		const write = (await request.formData()).get('write') === 'on';
		audit('token_created', { userId: me.id, ip: locals.ip }, `${write ? 'write' : 'read'} ${campaign.name}`);
		return { section: 'claude', token: createApiToken(me.id, campaign.id, write), url: `${url.origin}/mcp` };
	},
	// Chiude tutto: il token del plugin e i connettori.
	claudeRevoke: async ({ locals, url }) => {
		const { campaign, me } = mine(locals, url);
		revokeApiToken(me.id, campaign.id);
		audit('token_revoked', { userId: me.id, ip: locals.ip }, campaign.name);
		return { section: 'claude', ok: 'claude.revoked' };
	}
};
