/** Contenuto di una pagina: documento JSON dell'editor (formato ProseMirror/TipTap). */
export interface DocNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: DocNode[];
	marks?: { type: string; attrs?: Record<string, unknown> }[];
	text?: string;
}

export const EMPTY_DOC: DocNode = { type: 'doc', content: [{ type: 'paragraph' }] };

export const CALLOUT_KINDS = ['note', 'tip', 'warning'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export function isDoc(v: unknown): v is DocNode {
	return !!v && typeof v === 'object' && (v as DocNode).type === 'doc';
}

/** Campo della scheda di una pagina (es. "Allineamento: Caotico buono"). Il valore accetta [[collegamenti]]. */
export interface PageField {
	label: string;
	value: string;
}

/** Data nel calendario del mondo: mese e giorno possono mancare ("anno 1490"). Mese e giorno partono da 1. */
export interface WorldDate {
	year: number;
	month?: number | null;
	day?: number | null;
}

/** Dati di un resoconto di sessione. */
export interface SessionInfo {
	number: number | null;
	/** Data reale, AAAA-MM-GG. */
	realDate: string | null;
	world: WorldDate | null;
}
