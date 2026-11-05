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

// Stars & Wishes: la sessione su cui il popup ha già chiesto, una per campagna, e per quanto non richiede.
// Prima si chiedeva «entrando», cioè con un cookie senza scadenza: sul telefono (e col browser che riapre le schede)
// non scade mai, e chi aveva aperto la wiki prima della sessione non vedeva più il popup.
const starWishCookie = (campaign: number) => `cs_sw_${campaign}`;
const STAR_WISH_PAUSE = 3 * 60 * 60;

export const load: LayoutServerLoad = ({ locals, cookies, request, url, depends, untrack }) => {
	depends('app:layout');
	const u = locals.user;
	const s = getSettings();
	const extra = extraThemes();
	// Barra a sinistra (pagine, tag, risorse e sezioni): niente titoli a chi non può ancora leggere la wiki (es. nella pagina di accesso).
	const tree = !!u || s.allowVisitors;
	const framed = request.headers.get('sec-fetch-dest') === 'iframe';
	// Stars & Wishes: alla prima pagina aperta dopo la sessione (non dentro un popup), e di nuovo qualche ora dopo
	// finché non si risponde. Nella vista giocatore il Master guarda soltanto: niente domande.
	const open = u && locals.campaign?.schedule && !locals.asPlayer && !framed ? openStarWish(u.id) : null;
	const asked = open ? `${open.id}/${open.date}` : null;
	const starWish = open && cookies.get(starWishCookie(locals.campaign!.id)) !== asked ? open : null;
	if (starWish)
		cookies.set(starWishCookie(locals.campaign!.id), asked!, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: untrack(() => url.protocol) === 'https:',
			maxAge: STAR_WISH_PAUSE
		});
	return {
		user: u ? { id: u.id, username: u.username, displayName: u.displayName, role: u.role, admin: !!u.admin, icon: u.icon, avatar: u.avatar, asPlayer: locals.asPlayer } : null,
		prefs: locals.prefs,
		treeHidden: cookies.get(TREE_COOKIE) === '1',
		sideHidden: cookies.get(SIDE_COOKIE) === '1',
		framed,
		locale: locals.locale,
		siteName: s.siteName,
		asPlayer: locals.asPlayer,
		// Gli appuntamenti sono un'opzione della campagna: spenti, la barra non ne ha la voce.
		campaign: locals.campaign && { id: locals.campaign.id, name: locals.campaign.name, schedule: locals.campaign.schedule },
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
		starWish
	};
};
