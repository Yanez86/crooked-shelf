/**
 * Copertina della pagina, in alto come in Notion: un'immagine caricata o un colore pieno.
 * `y` dice quale parte dell'immagine si vede quando la fascia è più bassa dell'immagine (0 = in alto, 100 = in basso).
 */
export interface PageCover {
	image: string | null;
	color: string | null;
	y: number;
}

/** Colori pieni per le copertine: una fascia decorativa, uguale in tutti i temi. */
export const COVER_COLORS: Record<string, string> = {
	rust: '#7a2e1c',
	night: '#3a4765',
	forest: '#2b4839',
	sea: '#245b78',
	stone: '#5c5852',
	parchment: '#d9c9a3'
};

export const COVER_Y_DEFAULT = 50;

/** Posizione valida (intero tra 0 e 100); altrimenti quella di base, al centro. */
export function coverY(v: unknown): number {
	const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
	return typeof n === 'number' && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : COVER_Y_DEFAULT;
}

/**
 * Copertina ripulita. `image` dice quale file mostrare (null = il file non va bene).
 * Se ci sono sia l'immagine sia il colore vince l'immagine; senza nessuno dei due non c'è copertina.
 */
export function cleanCover(raw: { image?: unknown; color?: unknown; y?: unknown } | null | undefined, image: (id: string) => string | null): PageCover | null {
	if (!raw || typeof raw !== 'object') return null;
	const file = typeof raw.image === 'string' && raw.image ? image(raw.image) : null;
	if (file) return { image: file, color: null, y: coverY(raw.y) };
	if (typeof raw.color === 'string' && Object.hasOwn(COVER_COLORS, raw.color)) return { image: null, color: raw.color, y: COVER_Y_DEFAULT };
	return null;
}
