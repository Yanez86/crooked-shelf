import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { CLIENT_ID, isLoopback, issueCode, redirectHost } from '#lib/server/oauth.ts';

/**
 * La richiesta di Claude, controllata; null se non va: senza un indirizzo di ritorno valido non si rimanda da nessuna parte.
 * La campagna viene dall'indirizzo del connettore (resource, RFC 8707): un connettore per campagna, così Claude non le mescola.
 */
function request(url: URL) {
	const q = url.searchParams;
	const redirectUri = q.get('redirect_uri') ?? '';
	const host = redirectHost(redirectUri);
	const challenge = q.get('code_challenge') ?? '';
	const [, campaignId] = /^\/mcp\/(\d+)$/.exec(q.get('resource')?.startsWith(url.origin) ? q.get('resource')!.slice(url.origin.length) : '') ?? [];
	const ok =
		q.get('response_type') === 'code' &&
		q.get('client_id') === CLIENT_ID &&
		q.get('code_challenge_method') === 'S256' &&
		/^[\w-]{43,128}$/.test(challenge);
	return host && ok && campaignId ? { redirectUri, host, challenge, campaignId: Number(campaignId), state: q.get('state') } : null;
}

/** La campagna del connettore, se chi ha fatto l'accesso ne è il Master. */
const ownCampaign = (locals: App.Locals, id: number) => locals.campaigns.find((c) => c.id === id && c.masterId === locals.user?.id);

export const load: PageServerLoad = ({ url, locals }) => {
	const r = request(url);
	if (!r) return { invalid: true as const };
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const campaign = ownCampaign(locals, r.campaignId);
	return { invalid: false as const, host: r.host, local: isLoopback(r.host), campaign: campaign?.name ?? null };
};

export const actions: Actions = {
	default: async ({ request: req, url, locals }) => {
		const r = request(url);
		if (!r || !locals.user) return fail(400, { error: 'oauth.invalid' });
		const f = await req.formData();
		const back = new URL(r.redirectUri);
		if (r.state) back.searchParams.set('state', r.state);
		if (f.get('decision') !== 'allow') {
			back.searchParams.set('error', 'access_denied');
			return { location: back.href };
		}
		const campaign = ownCampaign(locals, r.campaignId);
		if (!campaign) return fail(403, { error: 'oauth.notMaster' });
		const code = issueCode({ userId: locals.user.id, campaignId: campaign.id, canWrite: f.get('write') === 'on', redirectUri: r.redirectUri, challenge: r.challenge });
		back.searchParams.set('code', code);
		// Non un redirect: la CSP (form-action 'self') bloccherebbe il ritorno a un altro sito dopo un form.
		return { location: back.href };
	}
};
