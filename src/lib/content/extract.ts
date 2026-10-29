import type { DocNode } from './types.ts';

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

/** Estrae testo per la ricerca, collegamenti e presenza di segreti. */
export function extract(doc: DocNode): Extracted {
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
		for (const c of n.content ?? []) walk(c, secret);
		if (BLOCK.has(n.type)) out.push('\n');
	};
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
