import { error, redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { clearSessionCookie, hasUsers, sessionCookie, setSessionCookie, validateApiToken, validateSession } from '#lib/server/auth.ts';
import { maintenance } from '#lib/server/maintenance.ts';
import { startAutoBackup } from '#lib/server/autoBackup.ts';
import { getSettings } from '#lib/server/settings.ts';
import { announceSetupToken } from '#lib/server/setup.ts';
import { limited } from '#lib/server/ratelimit.ts';
import { AS_PLAYER_COOKIE, CAMPAIGN_COOKIE, NO_CAMPAIGN, campaignsFor, inCampaign, roleIn } from '#lib/server/campaigns.ts';
import { allPlugins, extraThemes } from '#lib/server/plugins.ts';
import { ensureSheets } from '#lib/server/sheets.ts';
import { isAdmin, isMaster } from '#lib/access.ts';
import { cleanPrefs, PREFS_COOKIE } from '#lib/prefs.ts';
import { fromAcceptLanguage, isLocale, DEFAULT_LOCALE } from '#lib/i18n/index.ts';

// Pagine raggiungibili senza aver fatto l'accesso. /mcp risponde da sé: 401 senza un token valido.
// Il connettore di Claude si registra e prende il token dai suoi server; il consenso (/oauth/authorize) chiede l'accesso.
const OPEN = ['/login', '/setup', '/invite/', '/reset/', '/mcp', '/oauth/register', '/oauth/token', '/.well-known/'];
// Il controllo di SvelteKit sui form mandati da altri siti è spento (csrf.trustedOrigins in vite.config.ts) e si fa qui,
// uguale, tranne che per /oauth/token: lì scrivono i server di Claude, che non mandano Origin.
const FORM_TYPES = ['', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', 'application/x-sveltekit-formdata'];
const WRITES = ['POST', 'PUT', 'PATCH', 'DELETE'];
// Quello che resta a chi ha un account ma non è in nessuna campagna: anche crearne una sua.
const WITHOUT_CAMPAIGN = ['/campaign', '/profile', '/logout'];
// Nella vista giocatore si guarda soltanto: si scrive solo per tornare alla propria vista, cambiare campagna o crearne una, nel proprio profilo e per uscire.
const AS_PLAYER_WRITES = ['/campaign', '/profile', '/logout'];
const READS = ['GET', 'HEAD', 'OPTIONS'];
const MINUTE = 60_000;
// Limiti per IP sulle scritture che costano o che qualcuno potrebbe tentare a raffica. Chi li supera riceve 429.
const LIMITS: { test: (path: string, search: string) => boolean; name: string; max: number; window: number }[] = [
	// Gli accessi riusciti di una casa dietro un solo indirizzo non devono bloccarsi: qui il tetto è largo, quelli falliti li conta /login (20 ogni 10 minuti per indirizzo).
	{ test: (p) => p === '/login', name: 'login', max: 120, window: 10 * MINUTE },
	{ test: (p) => p === '/setup', name: 'setup', max: 20, window: 10 * MINUTE },
	{ test: (p) => p.startsWith('/invite/') || p.startsWith('/reset/'), name: 'register', max: 20, window: 10 * MINUTE },
	{ test: (p, s) => p === '/profile' && s.startsWith('?/password'), name: 'password', max: 10, window: 10 * MINUTE },
	{ test: (p) => p === '/oauth/token', name: 'oauth', max: 30, window: 10 * MINUTE },
	{ test: (p) => p === '/api/files', name: 'upload', max: 60, window: 10 * MINUTE },
	// Una campagna nuova nasce con le sue pagine di partenza.
	{ test: (p, s) => p === '/campaign' && s.startsWith('?/newCampaign'), name: 'campaign', max: 20, window: 10 * MINUTE },
	{ test: (p) => p.startsWith('/mcp'), name: 'mcp', max: 300, window: MINUTE },
	// Password dei backup (ogni prova costa 128 MB di memoria) e backup fatti a mano.
	{ test: (p) => p === '/admin/backup', name: 'backup', max: 30, window: 10 * MINUTE }
];
// Dimensione massima del corpo per tipo di route: i moduli che caricano file hanno il limite del server (BODY_SIZE_LIMIT).
const UPLOADS = [/^\/api\/files$/, /^\/profile$/, /^\/wiki\/new$/, /^\/wiki\/[^/]+\/edit$/, /^\/resources\//, /^\/admin\/world$/, /^\/admin\/themes\//];
const KB = 1024;

function readCookiePrefs(raw: string | undefined): Record<string, unknown> | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

// All'avvio del server: il backup automatico ha un suo timer, perché deve partire anche di notte, senza visite.
export const init: ServerInit = () => startAutoBackup();

export const handle: Handle = async ({ event, resolve }) => {
	const { cookies, url, locals, request } = event;
	const type = (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
	if (url.pathname !== '/oauth/token' && WRITES.includes(request.method) && FORM_TYPES.includes(type) && request.headers.get('origin') !== url.origin)
		return new Response(`Cross-site ${request.method} form submissions are forbidden`, { status: 403 });
	let ip = 'unknown';
	try {
		ip = event.getClientAddress();
	} catch {
		/* senza indirizzo (es. nei test) i limiti valgono per tutti insieme */
	}
	locals.ip = ip;
	if (WRITES.includes(request.method)) {
		const lim = LIMITS.find((l) => l.test(url.pathname, url.search));
		if (lim && limited(lim.name, ip, lim.max, lim.window)) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(Math.ceil(lim.window / 1000)) } });
	}
	const ready = hasUsers();
	if (!ready) announceSetupToken();
	else maintenance();
	allPlugins();

	// Claude entra solo da /mcp (o /mcp/<campagna>, il connettore), col suo token: lì i cookie non contano, e il token non apre il resto della wiki.
	const [mcp, mcpCampaign] = /^\/mcp(?:\/(\d+))?$/.exec(url.pathname) ?? [];
	const api = mcp ? validateApiToken(event.request.headers.get('authorization')) : null;

	locals.user = api?.user ?? null;
	locals.mcpWrite = api?.canWrite ?? false;
	const token = mcp ? undefined : cookies.get(sessionCookie(url));
	if (token) {
		const s = validateSession(token);
		if (s) {
			locals.user = s.user;
			if (s.expires) setSessionCookie(cookies, url, token, s.expires);
		} else clearSessionCookie(cookies, url);
	}

	if (WRITES.includes(request.method)) {
		const length = Number(request.headers.get('content-length') ?? 0);
		const max = mcp ? 2 * KB * KB : !locals.user ? 64 * KB : UPLOADS.some((r) => r.test(url.pathname)) ? Infinity : 4 * KB * KB;
		if (length > max) return new Response('Request body too large', { status: 413 });
	}

	const settings = getSettings();
	locals.campaigns = campaignsFor(locals.user, settings.allowVisitors);
	// Claude lavora su una campagna solo per il suo Master, e col connettore solo su quella dell'indirizzo.
	locals.campaign = mcp
		? (locals.campaigns.find((c) => c.id === api?.campaignId && c.masterId === api.user.id && (!mcpCampaign || c.id === Number(mcpCampaign))) ?? null)
		: (locals.campaigns.find((c) => c.id === Number(cookies.get(CAMPAIGN_COOKIE))) ?? locals.campaigns[0] ?? null);
	// Da qui in poi `role` vale per questa campagna: i controlli sui permessi non devono sapere che ce ne sono altre.
	const campaign = locals.campaign ?? NO_CAMPAIGN;
	if (locals.user) locals.user.role = roleIn(campaign, locals.user);
	// Vista giocatore: il ruolo cambia per tutta la richiesta, così anche il server tiene per sé i segreti, come per un vero giocatore.
	// Ed è un giocatore qualunque: non ha scritto niente e non scrive (vedi authorKey e canWrite in access.ts).
	locals.asPlayer = !mcp && isMaster(locals.user) && cookies.get(AS_PLAYER_COOKIE) === '1';
	if (locals.asPlayer) {
		locals.user!.role = 'player';
		locals.user!.admin = false;
		locals.user!.asPlayer = true;
	}

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
		const start = isAdmin(locals.user) ? '/admin/campaigns' : '/campaign';
		if (path !== start && !WITHOUT_CAMPAIGN.includes(path)) redirect(303, start);
	}
	if (locals.asPlayer && !READS.includes(event.request.method) && !AS_PLAYER_WRITES.includes(path)) error(403, 'Forbidden');

	const p = locals.prefs;
	const attrs = `data-theme="${p.theme}" data-font="${p.font}" data-spacing="${p.spacing}" data-motion="${p.motion}" style="--font-scale:${Number(p.fontSize) / 100}"`;
	const response = await inCampaign(campaign, () => {
		// Cartella PG e schede dei giocatori: se manca qualcosa (campagna di prima, giocatore appena entrato) si prepara ora.
		// Se non ci riesce la wiki va avanti lo stesso: ci riprova alla richiesta dopo.
		try {
			ensureSheets(settings.defaultLocale);
		} catch (e) {
			console.error('Schede giocatore:', e);
		}
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%cs.lang%', locals.locale).replace('%cs.attrs%', attrs)
		});
	});
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	// Non DENY: Profilo, Amministrazione e pagine collegate si aprono in un iframe della wiki stessa (PanelDialog).
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	// Solo in HTTPS (CS_ORIGIN o proxy): in rete locale in http il browser la ignorerebbe comunque.
	if (url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
	return response;
};
