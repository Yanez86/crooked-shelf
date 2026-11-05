/** Il marchio di Crooked Shelf: tre libri, uno storto, su uno scaffale. Un solo disegno per l'intestazione e per l'icona
 *  della scheda del browser; i colori vengono dal tema: il fondo è il colore principale, i libri quello che ci sta sopra. */
import { AUTO_THEMES, type Theme, type ThemeColors } from './themes.ts';

/** Le forme dei libri, su una tavola di 32×32. */
export const LOGO_BOOKS =
	'<rect x="6" y="7" width="4" height="18"/><rect x="11" y="9" width="4" height="16"/>' +
	'<rect x="16.5" y="8" width="4" height="17" transform="rotate(12 18.5 16.5)"/>' +
	'<rect x="5" y="25" width="22" height="2.5" transform="rotate(-4 16 26)"/>';

const svg = (style: string, bg: string, fg: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${style}<rect class="b" width="32" height="32" fill="${bg}"/><g class="f" fill="${fg}">${LOGO_BOOKS}</g></svg>`;

const dataUri = (s: string) => 'data:image/svg+xml,' + encodeURIComponent(s);

const pick = (c: ThemeColors) => [c.primary, c.onPrimary] as const;

/** L'icona della scheda per il tema scelto. «Automatico» porta tutte e due le versioni e segue il sistema, come la pagina. */
export function faviconHref(themeId: string, themes: Theme[]): string {
	const find = (id: string) => themes.find((t) => t.id === id);
	const chosen = find(themeId);
	if (chosen) return dataUri(svg('', ...pick(chosen.colors)));
	const [lb, lf] = pick(find(AUTO_THEMES.light)!.colors);
	const [db, df] = pick(find(AUTO_THEMES.dark)!.colors);
	return dataUri(svg(`<style>@media (prefers-color-scheme: dark){.b{fill:${db}}.f{fill:${df}}}</style>`, lb, lf));
}
