import type { DocNode, PageField } from './types.ts';
import { slugify } from '../slug.ts';

/** [[Titolo]] o [[Titolo|testo]] dentro un testo semplice. */
export const INLINE_LINK = /\[\[([^[\]|\n]{1,200})(?:\|([^[\]\n]{1,200}))?\]\]/g;

/** Collegamenti scritti come testo. */
export function inlineLinks(text: string): string[] {
	return [...text.matchAll(INLINE_LINK)].map((m) => slugify(m[1].trim()));
}

/** Testo leggibile: [[Titolo|testo]] diventa "testo". */
export function inlinePlain(text: string): string {
	return text.replace(INLINE_LINK, (_, t, l) => (l ?? t).trim());
}

export interface WikiLinkRef {
	target: string;
	secret: boolean;
}

export interface Extracted {
	/** Testo visibile a tutti quelli che vedono la pagina. */
	body: string;
	/** Testo dentro i blocchi segreti del Master. */
	secretBody: string;
	links: WikiLinkRef[];
	hasSecret: boolean;
}

const BLOCK = new Set([
	'paragraph',
	'heading',
	'blockquote',
	'codeBlock',
	'listItem',
	'tableCell',
	'tableHeader',
	'callout',
	'secret'
]);

/** Estrae testo per la ricerca, collegamenti e presenza di segreti (anche dai campi della scheda). */
export function extract(doc: DocNode, fields: PageField[] = []): Extracted {
	const pub: string[] = [];
	const sec: string[] = [];
	const links: WikiLinkRef[] = [];
	let hasSecret = false;

	const walk = (n: DocNode, secret: boolean) => {
		if (n.type === 'secret') {
			hasSecret = true;
			secret = true;
		}
		const out = secret ? sec : pub;
		if (n.type === 'text' && n.text) out.push(n.text);
		else if (n.type === 'wikiLink') {
			const target = String(n.attrs?.target ?? '');
			if (target) links.push({ target, secret });
			const label = n.attrs?.label ?? n.attrs?.title;
			if (label) out.push(String(label));
		} else if (n.type === 'hardBreak') out.push(' ');
		else if (n.type === 'image' && n.attrs?.alt) out.push(` ${n.attrs.alt} `);
		for (const c of n.content ?? []) walk(c, secret);
		if (BLOCK.has(n.type)) out.push('\n');
	};
	for (const f of fields) {
		pub.push(`${f.label}: ${inlinePlain(f.value)}\n`);
		for (const target of inlineLinks(f.value)) links.push({ target, secret: false });
	}
	walk(doc, false);

	const clean = (parts: string[]) =>
		parts
			.join('')
			.replace(/[ \t]+/g, ' ')
			.replace(/\s*\n\s*/g, '\n')
			.trim();

	// Un collegamento presente sia fuori sia dentro un segreto conta come pubblico.
	const map = new Map<string, boolean>();
	for (const l of links) map.set(l.target, (map.get(l.target) ?? true) && l.secret);
	return {
		body: clean(pub),
		secretBody: clean(sec),
		links: [...map].map(([target, secret]) => ({ target, secret })),
		hasSecret
	};
}

/** Toglie i blocchi segreti (contenuto inviato da chi non può scriverli). */
export function stripSecrets(n: DocNode): DocNode {
	if (!n.content) return n;
	return { ...n, content: n.content.filter((c) => c.type !== 'secret').map(stripSecrets) };
}
