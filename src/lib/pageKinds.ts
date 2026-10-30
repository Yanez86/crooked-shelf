import { isMaster, type Viewer } from './access.ts';

/**
 * Tipi di pagina. Tutte stanno nell'albero a sinistra e si aprono in /wiki/<indirizzo>:
 * - `page`: una pagina normale, bianca o fotocopiata da un template;
 * - `template`: una pagina da fotocopiare, con la struttura (blocchi, colonna a lato, icona) decisa da chi la scrive;
 * - `map`: una pagina con una mappa (pin, livelli, mappe annidate);
 * - `timeline`: una pagina con una cronologia (eventi ordinati per data nel mondo o per data di gioco).
 */
export const PAGE_KINDS = ['page', 'template', 'map', 'timeline'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export const isPageKind = (v: unknown): v is PageKind => typeof v === 'string' && (PAGE_KINDS as readonly string[]).includes(v);

/** Template, mappe e cronologie li crea il Master; le pagine chiunque abbia fatto l'accesso. */
export const canCreateKind = (kind: PageKind, u: Viewer | null) => !!u && (kind === 'page' || isMaster(u));

/** Cronologia del mondo (per data nel mondo, la scrive il Master) o della campagna (per data di gioco, anche i giocatori; ci entrano i resoconti di sessione). */
export const TIMELINE_MODES = ['world', 'campaign'] as const;
export type TimelineMode = (typeof TIMELINE_MODES)[number];

/** Icona nell'albero per le pagine senza un'icona scelta (stesso disegno a tratto di PAGE_ICONS). */
export const KIND_ICONS: Record<Exclude<PageKind, 'page'>, string> = {
	template: 'M8.5 7.5h11v13.75h-11zM5.5 17H4.5V2.75h11v1.75M11 11.5h6M11 14.5h6M11 17.5h4',
	map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
	timeline: 'M6 2.5h12M6 21.5h12M7.5 2.5c0 4.5 9 5 9 9.5s-9 5-9 9.5M16.5 2.5c0 4.5-9 5-9 9.5s9 5 9 9.5'
};
