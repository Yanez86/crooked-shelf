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
