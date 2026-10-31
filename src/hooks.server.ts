import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	hasUsers,
	setSessionCookie,
	validateSession
} from '#lib/server/auth.ts';
import { getSettings } from '#lib/server/settings.ts';
import { CAMPAIGN_COOKIE, NO_CAMPAIGN, campaignsFor, inCampaign, roleIn } from '#lib/server/campaigns.ts';
import { allPlugins, extraThemes } from '#lib/server/plugins.ts';
import { cleanPrefs, PREFS_COOKIE } from '#lib/prefs.ts';
import { fromAcceptLanguage, isLocale, DEFAULT_LOCALE } from '#lib/i18n/index.ts';

// Pagine raggiungibili senza aver fatto l'accesso.
const OPEN = ['/login', '/setup', '/invite/'];
// Quello che resta a chi ha un account ma non è in nessuna campagna.
const WITHOUT_CAMPAIGN = ['/campaign', '/profile', '/logout'];

function readCookiePrefs(raw: string | undefined): Record<string, unknown> | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const { cookies, url, locals } = event;
	const ready = hasUsers();
	allPlugins();

	locals.user = null;
	const token = cookies.get(SESSION_COOKIE);
	if (token) {
		const s = validateSession(token);
		if (s) {
			locals.user = s.user;
			if (s.expires) setSessionCookie(cookies, url, token, s.expires);
		} else clearSessionCookie(cookies);
	}

	const settings = getSettings();
	locals.campaigns = campaignsFor(locals.user, settings.allowVisitors);
	locals.campaign = locals.campaigns.find((c) => c.id === Number(cookies.get(CAMPAIGN_COOKIE))) ?? locals.campaigns[0] ?? null;
	// Da qui in poi `role` vale per questa campagna: i controlli sui permessi non devono sapere che ce ne sono altre.
	const campaign = locals.campaign ?? NO_CAMPAIGN;
	if (locals.user) locals.user.role = roleIn(campaign, locals.user);

	locals.prefs = cleanPrefs(
		locals.user ? locals.user.prefs : readCookiePrefs(cookies.get(PREFS_COOKIE)),
		isLocale,
		extraThemes().map((t) => t.id)
	);
	locals.locale =
		locals.prefs.locale ??
		(ready ? settings.defaultLocale : fromAcceptLanguage(event.request.headers.get('accept-language'))) ??
		DEFAULT_LOCALE;

	const path = url.pathname;
	const open = OPEN.some((p) => path === p || path.startsWith(p));
	if (!ready && !path.startsWith('/setup')) redirect(303, '/setup');
	if (ready && path.startsWith('/setup')) redirect(303, '/');
	if (!locals.user && !settings.allowVisitors && !open) {
		redirect(303, `/login${path === '/' ? '' : `?next=${encodeURIComponent(path + url.search)}`}`);
	}
	if (locals.user && !locals.campaign && !open) {
		// L'Admin che le ha eliminate tutte riparte da una nuova; il resto dell'amministrazione lavora sulla campagna corrente.
		const start = locals.user.role === 'admin' ? '/admin/campaigns' : '/campaign';
		if (path !== start && !WITHOUT_CAMPAIGN.includes(path)) redirect(303, start);
	}

	const p = locals.prefs;
	const attrs = `data-theme="${p.theme}" data-font="${p.font}" data-spacing="${p.spacing}" data-motion="${p.motion}" style="--font-scale:${Number(p.fontSize) / 100}"`;
	const response = await inCampaign(campaign, () =>
		resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%cs.lang%', locals.locale).replace('%cs.attrs%', attrs)
		})
	);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	// Non DENY: Profilo, Amministrazione e pagine collegate si aprono in un iframe della wiki stessa (PanelDialog).
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	return response;
};
