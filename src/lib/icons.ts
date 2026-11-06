import { PAGE_ICONS } from './pageIcons.ts';

/**
 * Icone dell'interfaccia. Stesso disegno delle icone delle pagine (`pageIcons.ts`): tratti su una griglia 24×24,
 * in un solo colore (`currentColor`), con gli angoli vivi dove il disegno lo permette.
 */
export const UI_ICONS: Record<string, string> = {
	// Azioni
	plus: 'M12 5v14M5 12h14',
	minus: 'M5 12h14',
	// Due frecce sulla diagonale: cambia la dimensione (di un'immagine).
	resize: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
	close: 'M6 6l12 12M18 6 6 18',
	check: 'M5 12.5l4.5 4.5L19 7.5',
	edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
	save: 'M3.75 3.75h12.75l3.75 3.75v12.75H3.75zM8 3.75V9h7.5V3.75M7 20.25V13.5h10v6.75',
	trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
	upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 14.5v4.75h15V14.5',
	move: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4',
	menu: 'M4 6.5h16M4 12h16M4 17.5h16',
	// La maniglia per trascinare: sei punti.
	grip: 'M9 5.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 5.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM9 11.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 11.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM9 17.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2zM15 17.4a.6.6 0 1 0 0 1.2.6.6 0 1 0 0-1.2z',
	sliders: 'M4 7h9M19 7h1M4 17h1M11 17h9M16 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
	search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.25 15.25 20 20',
	none: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.64 18.36 18.36 5.64',
	// Frecce
	arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
	arrowRight: 'M5 12h14M13 6l6 6-6 6',
	arrowUp: 'M12 19V5M6 11l6-6 6 6',
	arrowDown: 'M12 5v14M6 13l6 6 6-6',
	chevronDown: 'M6 9l6 6 6-6',
	chevronUp: 'M6 15l6-6 6 6',
	chevronRight: 'M9 6l6 6-6 6',
	expandAll: 'M7 9l5-5 5 5M7 15l5 5 5-5',
	collapseAll: 'M7 4l5 5 5-5M7 20l5-5 5 5',
	fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
	// Oggetti
	doc: 'M6 2.75h8.25L19 7.5v13.75H6zM14 2.75V7.5h5M9 12h7M9 15.5h7',
	docPlus: 'M6 2.75h8.25L19 7.5v13.75H6zM14 2.75V7.5h5M12.5 11v6M9.5 14h6',
	folder: 'M2.75 5.25h6.5l2 2.5h10v11H2.75z',
	folderOpen: 'M2.75 18.75V5.25h6.5l2 2.5h8v3M2.75 18.75l3-8h15.5l-3 8z',
	folderPlus: 'M2.75 5.25h6.5l2 2.5h10v11H2.75zM12 10.5v6M9 13.5h6',
	template: 'M8.5 7.5h11v13.75h-11zM5.5 17H4.5V2.75h11v1.75M11 11.5h6M11 14.5h6M11 17.5h4',
	divider: 'M3 12h18M7 6.5h10M7 17.5h10',
	tag: 'M3.75 3.75h7.5l9 9-7.5 7.5-9-9zM8.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
	crop: 'M6 2.5V18h15.5M2.5 6H18v15.5',
	image: 'M3.75 4.75h16.5v14.5H3.75zM3.75 16l5-5 4 4 2.5-2.5 5 5M17 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
	audio: 'M9 18V5.5l11-2.5v12.5M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
	lock: 'M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 8 0V11',
	// Visibilità delle pagine: lucchetto = Personale.
	globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9',
	eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
	eyeOff: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 20 20 4',
	panel: 'M3.75 4.75h16.5v14.5H3.75zM9.5 4.75v14.5M5.75 8.5h1.75M5.75 11.5h1.75',
	ruler: 'M3 16.5 16.5 3 21 7.5 7.5 21zM7.5 12l2 2M10.5 9l2 2M13.5 6l2 2',
	marker: 'M12 21.25s-6.5-5.75-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.75-6.5 11.5-6.5 11.5zM12 7.75a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
	// Mappe a esagoni: l'esagono (il terreno) e la bandierina (il gruppo).
	hexagon: 'M7 3.5h10l5 8.5-5 8.5H7l-5-8.5z',
	flag: 'M6 21V4M6 4h11l-2.5 4L17 12H6',
	layers: 'M12 3 3 8l9 5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
	markerPlus: 'M12 21.25s-6.5-5.75-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.75-6.5 11.5-6.5 11.5zM12 7v5.5M9.25 9.75h5.5',
	contrast: 'M3.75 3.75h16.5v16.5H3.75zM3.75 20.25 20.25 3.75',
	info: 'M12 10v8.5M12 5.5v.01M8.5 18.5h7M9 10h3',
	calendar: 'M3.75 5.25h16.5v15H3.75zM3.75 9.75h16.5M8 3v4.5M16 3v4.5',
	clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.5 2',
	// Collegamenti della pagina Info. Il gatto di GitHub viene da Feather Icons (MIT, vedi THIRD_PARTY_NOTICES.md).
	github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
	squid: 'M12 2.5c-3.5 2.5-5.5 5.5-5.5 8.5 0 1.5.5 2.5 1.5 3h8c1-.5 1.5-1.5 1.5-3 0-3-2-6-5.5-8.5zM9.75 10v.01M14.25 10v.01M8.5 14c-.5 2.5-2.5 4-5 5M10.75 14c0 3-.5 5-1.75 7M13.25 14c0 3 .5 5 1.75 7M15.5 14c.5 2.5 2.5 4 5 5',
	// Editor
	bold: 'M7 4.5h6a3.75 3.75 0 0 1 0 7.5H7zM7 12h7a3.75 3.75 0 0 1 0 7.5H7z',
	italic: 'M10 4.5h8M6 19.5h8M14 4.5l-4 15',
	underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
	strike: 'M16.5 7A4.5 4.5 0 0 0 12.5 4.5h-1a3.75 3.75 0 0 0-2.5 6.5M8 17a4.5 4.5 0 0 0 4 2.5h.5a3.75 3.75 0 0 0 3.5-5M4 12h16',
	code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
	link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.5 6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.7-1.6',
	// Il controller di Discord, nello stesso tratto delle altre: per il link della sessione da remoto.
	discord: 'M8.5 6.5c-1.7.3-3.2.9-4.5 1.7-1.9 2.9-2.6 6.1-2.2 9.4 1.5 1.2 3.2 2 5 2.5l1.2-2M15.5 6.5c1.7.3 3.2.9 4.5 1.7 1.9 2.9 2.6 6.1 2.2 9.4-1.5 1.2-3.2 2-5 2.5l-1.2-2M6.5 16.5c3.5 1.6 7.5 1.6 11 0M7 8.5c3.3-1.2 6.7-1.2 10 0M10 12.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zM16.5 12.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z',
	wikiLink: 'M9 4H5v16h4M15 4h4v16h-4',
	listBullet: 'M9.5 6h10.5M9.5 12h10.5M9.5 18h10.5M4.5 6h.5M4.5 12h.5M4.5 18h.5',
	listNumber: 'M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5h3l-3 4.5h3',
	quote: 'M4 11.5h5v6H4zM4 11.5C4 8.5 5.5 6.5 8 5.5M14 11.5h5v6h-5zM14 11.5c0-3 1.5-5 4-6',
	note: 'M3.75 3.75h16.5v16.5H3.75zM12 11v5.5M12 7.75v.01',
	tip: 'M9.5 16.5h5M10 20h4M12 3.5a5.5 5.5 0 0 0-3.25 9.94c.47.35.75.9.75 1.48v1.58h5v-1.58c0-.58.28-1.13.75-1.48A5.5 5.5 0 0 0 12 3.5z',
	table: 'M3.75 4.75h16.5v14.5H3.75zM3.75 9.5h16.5M3.75 14.5h16.5M9.5 4.75v14.5M14.5 4.75v14.5',
	// Un d20: l'esagono, la faccia davanti e gli spigoli verso gli angoli.
	dice: 'M12 2.75 20 7.4v9.2l-8 4.65-8-4.65V7.4zM12 7.25l4.75 8.25h-9.5zM12 2.75v4.5M4 7.4l8-.15M20 7.4l-8-.15M7.25 15.5 4 16.6M16.75 15.5 20 16.6M7.25 15.5 12 21.25M16.75 15.5 12 21.25',
	rule: 'M3 12h18',
	undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
	redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
	markdown: 'M2.75 5.75h18.5v12.5H2.75zM6 15V9l2.5 3L11 9v6M16.5 9v6M14.25 12.75 16.5 15l2.25-2.25',
	// Pin delle mappe (gli altri vengono dalle icone delle pagine)
	dot: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
	city: 'M3 21V10l4-3 4 3v11M11 21V5h7v16M14 8.5h1M14 12h1M14 15.5h1M6 13h2M6 16.5h2M2 21h20',
	gate: 'M5 21V10a7 7 0 0 1 14 0v11M3 21h18M9 21V10.5M12 21V9M15 21V10.5',
	tent: 'M2.5 20h19M4 20 12 5l8 15M12 20v-5M9.5 20l2.5-5 2.5 5'
};

/** Il disegno di un'icona dell'interfaccia o di una pagina ('' se non c'è). */
export const iconPath = (name: string): string => UI_ICONS[name] ?? PAGE_ICONS[name] ?? '';

/** La stessa icona come documento SVG: per Leaflet e per le maschere dei CSS. */
export function iconSvg(name: string, stroke = '#000'): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPath(name)}"/></svg>`;
}

/** Icone usate nei CSS (::before, ::after): una variabile --icon-<nome> per ciascuna. */
const CSS_ICONS = ['lock', 'chevronDown', 'chevronUp', 'chevronRight', 'book', 'dice', 'search', 'check', 'resize'];

export function iconCss(): string {
	const vars = CSS_ICONS.map((n) => `--icon-${n.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:url("data:image/svg+xml,${encodeURIComponent(iconSvg(n))}")`);
	return `:root{${vars.join(';')}}`;
}
