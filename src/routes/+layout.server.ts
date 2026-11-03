import type { LayoutServerLoad } from './$types';
import { getSettings } from '#lib/server/settings.ts';
import { extraThemes } from '#lib/server/plugins.ts';
import { listTags, pageTree } from '#lib/server/taxonomy.ts';
import { isMaster } from '#lib/access.ts';
import { resourceEntries } from '#lib/server/gallery.ts';
import { openStarWish } from '#lib/server/schedule.ts';
import { extraLocale } from '#lib/i18n/index.ts';
import { THEMES, themeCss } from '#lib/themes.ts';
import { faviconHref } from '#lib/logo.ts';
import { SIDE_COOKIE, TREE_COOKIE } from '#lib/prefs.ts';

// La campagna in cui si è entrati in questa sessione del browser: per Stars & Wishes, che chiede all'ingresso.
const ENTERED_COOKIE = 'cs_entered';

export const load: LayoutServerLoad = ({ locals, cookies, request, url, depends, untrack }) => {
	depends('app:layout');
	const u = locals.user;
	const s = getSettings();
	const extra = extraThemes();
	// Barra a sinistra (pagine, tag, risorse e sezioni): niente titoli a chi non può ancora leggere la wiki (es. nella pagina di accesso).
	const tree = !!u || s.allowVisitors;
	// Si entra aprendo la wiki o passando da un'altra campagna. Il cookie non ha scadenza: chiuso il browser, si rientra.
	const entered = !!u && !!locals.campaign && cookies.get(ENTERED_COOKIE) !== String(locals.campaign.id);
	if (entered)
		cookies.set(ENTERED_COOKIE, String(locals.campaign!.id), { path: '/', httpOnly: true, sameSite: 'lax', secure: untrack(() => url.protocol) === 'https:' });
	return {
		user: u ? { id: u.id, username: u.username, displayName: u.displayName, role: u.role, admin: !!u.admin, icon: u.icon, avatar: u.avatar, asPlayer: locals.asPlayer } : null,
		prefs: locals.prefs,
		treeHidden: cookies.get(TREE_COOKIE) === '1',
		sideHidden: cookies.get(SIDE_COOKIE) === '1',
		framed: request.headers.get('sec-fetch-dest') === 'iframe',
		locale: locals.locale,
		siteName: s.siteName,
		asPlayer: locals.asPlayer,
		campaign: locals.campaign && { id: locals.campaign.id, name: locals.campaign.name },
		campaigns: locals.campaigns.map(({ id, name }) => ({ id, name })),
		version: __APP_VERSION__,
		themeCss: themeCss(extra),
		// L'icona della scheda nei colori del tema di chi guarda.
		favicon: faviconHref(locals.prefs.theme, [...THEMES, ...extra]),
		// Traduzioni dei plugin per la lingua in uso (il browser non le ha nel pacchetto).
		localeExtra: extraLocale(locals.locale),
		tree: tree ? pageTree(u) : null,
		// Il Master vede anche i tag senza pagine: da lì ne cambia nome e colore.
		treeTags: tree ? listTags(u, isMaster(u)).map(({ id, name, slug, color, count }) => ({ id, name, slug, color, count })) : null,
		resources: tree ? resourceEntries(u).map(({ id, title, kind }) => ({ id, title, kind })) : null,
		// Nella vista giocatore il Master guarda soltanto: niente domande.
		starWish: entered && !locals.asPlayer ? openStarWish(u!.id) : null
	};
};
