import type { DocNode, PageField } from './types.ts';
import { INLINE_LINK } from './extract.ts';
import { blockVisibility } from './blocks.ts';
import { slugify } from '../slug.ts';
import { parseRuleKind } from '../rules/index.ts';

export interface MarkdownOptions {
	/** Includere i blocchi nascosti (i segreti del Master, come callout "secret"). */
	secrets: boolean;
	/** Titolo della pagina collegata (per scrivere [[Titolo]]); null se la pagina non esiste. */
	titleOf: (slug: string) => string | null;
	/** Indirizzo da usare per un'immagine caricata (/files/<id>). */
	imagePath?: (src: string) => string;
}

const escText = (s: string) => s.replace(/([\\`*_[\]<>#|])/g, '\\$1');

function inline(nodes: DocNode[] | undefined, o: MarkdownOptions): string {
	return (nodes ?? [])
		.map((n) => {
			if (n.type === 'text') {
				let t = escText(n.text ?? '');
				for (const m of n.marks ?? []) {
					if (m.type === 'bold') t = `**${t}**`;
					else if (m.type === 'italic') t = `*${t}*`;
					else if (m.type === 'strike') t = `~~${t}~~`;
					else if (m.type === 'underline') t = `<u>${t}</u>`;
					else if (m.type === 'code') t = '`' + (n.text ?? '').replace(/`/g, 'ˋ') + '`';
					else if (m.type === 'link' && typeof m.attrs?.href === 'string') t = `[${t}](${m.attrs.href})`;
				}
				return t;
			}
			if (n.type === 'hardBreak') return '  \n';
			if (n.type === 'wikiLink') {
				const target = String(n.attrs?.target ?? '');
				const title = o.titleOf(target) ?? String(n.attrs?.title ?? target);
				const label = n.attrs?.label ? String(n.attrs.label) : null;
				return label && label !== title ? `[[${title}|${label}]]` : `[[${title}]]`;
			}
			if (n.type === 'ruleRef') {
				const label = n.attrs?.label ? `|${n.attrs.label}` : '';
				return `@${n.attrs?.kind}[${n.attrs?.name}${label}]`;
			}
			return '';
		})
		.join('');
}

/** Più blocchi, con una riga vuota tra uno e l'altro. */
const joined = (parts: string[][]) => parts.flatMap((lines, i) => (i < parts.length - 1 ? [...lines, ''] : lines));

const quoted = (lines: string[]) => lines.map((l) => (l ? `> ${l}` : '>'));

/** I blocchi di primo livello: i segreti uno dopo l'altro vanno in un solo callout. */
function topLevel(nodes: DocNode[], o: MarkdownOptions): string[] {
	const parts: string[][] = [];
	let secret: string[][] = [];
	const flush = () => {
		if (secret.length) parts.push(['> [!secret]', ...quoted(joined(secret))]);
		secret = [];
	};
	for (const n of nodes) {
		const v = blockVisibility(n);
		if (v && !o.secrets) continue;
		if (v !== 'master') {
			flush();
			parts.push(block(n, o));
		} else secret.push(n.type === 'secret' ? joined((n.content ?? []).map((c) => block(c, o))) : block(n, o));
	}
	flush();
	return joined(parts.filter((p) => p.length));
}

function block(n: DocNode, o: MarkdownOptions): string[] {
	if (n.type === 'doc') return topLevel(n.content ?? [], o);
	// Anche più in basso nel documento, un nodo nascosto resta fuori.
	if (blockVisibility(n) && !o.secrets) return [];
	const kids = joined((n.content ?? []).map((c) => block(c, o)));
	switch (n.type) {
		case 'paragraph':
			return [inline(n.content, o)];
		case 'heading':
			return ['#'.repeat(Math.min(6, Math.max(1, Number(n.attrs?.level) || 2))) + ' ' + inline(n.content, o)];
		case 'blockquote':
			return quoted(kids);
		case 'callout':
		case 'secret': {
			const kind = n.type === 'secret' ? 'secret' : String(n.attrs?.kind ?? 'note');
			return [`> [!${kind}]`, ...quoted(kids)];
		}
		case 'codeBlock':
			return ['```', ...(n.content ?? []).map((c) => c.text ?? '').join('').split('\n'), '```'];
		case 'horizontalRule':
			return ['---'];
		case 'image': {
			const src = String(n.attrs?.src ?? '');
			return [`![${escText(String(n.attrs?.alt ?? ''))}](${o.imagePath ? o.imagePath(src) : src})`];
		}
		case 'bulletList':
		case 'orderedList': {
			const start = Number(n.attrs?.start ?? 1) || 1;
			return (n.content ?? []).flatMap((item, i) => {
				const marker = n.type === 'bulletList' ? '- ' : `${start + i}. `;
				const lines = (item.content ?? []).flatMap((c) => block(c, o));
				return lines.map((l, j) => (j === 0 ? marker : ' '.repeat(marker.length)) + l);
			});
		}
		case 'table': {
			const rows = (n.content ?? []).map((r) => (r.content ?? []).map((c) => (c.content ?? []).map((p) => inline(p.content, o)).join(' ').replace(/\|/g, '\\|')));
			if (!rows.length) return [];
			const width = Math.max(...rows.map((r) => r.length));
			const line = (r: string[]) => '| ' + Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ') + ' |';
			return [line(rows[0]), '|' + ' --- |'.repeat(width), ...rows.slice(1).map(line)];
		}
		default:
			return kids;
	}
}

/** Documento dell'editor in Markdown (compatibile con Obsidian: [[collegamenti]] e callout). */
export function toMarkdown(doc: DocNode, o: MarkdownOptions): string {
	return block(doc, o)
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

// Oltre a INLINE_LINK (gruppi 1-5): **grassetto** (6), *corsivo* (7), [testo](https://…) (8-9), __sottolineato__ (10). Lunghezze limitate: il testo arriva da fuori.
const INLINE = new RegExp(`${INLINE_LINK.source}|\\*\\*(.{1,2000}?)\\*\\*|\\*(.{1,2000}?)\\*|\\[([^\\]\\n]{1,200})\\]\\((https?://[^\\s)]{1,2000})\\)|__(.{1,2000}?)__`, 'g');

function inlineNodes(s: string, marks: NonNullable<DocNode['marks']> = []): DocNode[] {
	const out: DocNode[] = [];
	const text = (t: string) => {
		if (t) out.push({ type: 'text', text: t, ...(marks.length ? { marks } : {}) });
	};
	let last = 0;
	for (const m of s.matchAll(INLINE)) {
		text(s.slice(last, m.index));
		last = m.index + m[0].length;
		const kind = m[3] ? parseRuleKind(m[3]) : null;
		if (m[1]) out.push({ type: 'wikiLink', attrs: { target: slugify(m[1].trim()), title: m[1].trim(), label: m[2]?.trim() || null } });
		else if (kind) out.push({ type: 'ruleRef', attrs: { kind, name: m[4].trim(), label: m[5]?.trim() || null } });
		else if (m[3]) text(m[0]);
		else if (m[6]) out.push(...inlineNodes(m[6], [...marks, { type: 'bold' }]));
		else if (m[7]) out.push(...inlineNodes(m[7], [...marks, { type: 'italic' }]));
		else if (m[10]) out.push(...inlineNodes(m[10], [...marks, { type: 'underline' }]));
		else out.push(...inlineNodes(m[8], [...marks, { type: 'link', attrs: { href: m[9] } }]));
	}
	text(s.slice(last));
	return out;
}

const HEADING = /^(#{1,6})\s+(.+)$/;
const RULE = /^(-{3,}|\*{3,})$/;
const BULLET = /^[-*]\s+(.+)$/;
const NUMBER = /^\d+\.\s+(.+)$/;
const QUOTE = /^>\s?(.*)$/;

const paragraph = (s: string): DocNode => ({ type: 'paragraph', content: inlineNodes(s) });
const list = (type: string, items: string[]): DocNode => ({ type, content: items.map((s) => ({ type: 'listItem', content: [paragraph(s)] })) });

/**
 * Markdown scritto da fuori (Claude) in blocchi dell'editor. Può nascere solo ciò che è qui:
 * mai segreti, immagini o HTML, che resta testo. I livelli dei titoli sono quelli dell'editor.
 */
// ponytail: tabelle e blocchi di codice restano testo, aggiungerli se Claude ne ha bisogno.
export function fromMarkdown(text: string): DocNode[] {
	const lines = text.split(/\r?\n/).map((l) => l.trim());
	const out: DocNode[] = [];
	let i = 0;
	const run = (re: RegExp) => {
		const items: string[] = [];
		for (let m = re.exec(lines[i] ?? ''); m; m = re.exec(lines[++i] ?? '')) items.push(m[1]);
		return items;
	};
	while (i < lines.length) {
		const line = lines[i];
		const heading = HEADING.exec(line);
		if (!line) i++;
		else if (heading) {
			out.push({ type: 'heading', attrs: { level: Math.min(4, Math.max(2, heading[1].length)) }, content: inlineNodes(heading[2]) });
			i++;
		} else if (RULE.test(line)) {
			out.push({ type: 'horizontalRule' });
			i++;
		} else if (BULLET.test(line)) out.push(list('bulletList', run(BULLET)));
		else if (NUMBER.test(line)) out.push(list('orderedList', run(NUMBER)));
		else if (QUOTE.test(line)) {
			const quote = run(QUOTE).filter(Boolean).map(paragraph);
			if (quote.length) out.push({ type: 'blockquote', content: quote });
		} else {
			const para: string[] = [];
			while (lines[i] && ![HEADING, RULE, BULLET, NUMBER, QUOTE].some((re) => re.test(lines[i]))) para.push(lines[i++]);
			out.push(paragraph(para.join(' ')));
		}
	}
	return out;
}

const yamlString = (s: string) => JSON.stringify(s);

/** Intestazione YAML con titolo, categoria, tag, campi della scheda. */
export function frontMatter(meta: { title: string; category?: string | null; tags?: string[]; visibility?: string; fields?: PageField[] }): string {
	const lines = ['---', `title: ${yamlString(meta.title)}`];
	if (meta.category) lines.push(`category: ${yamlString(meta.category)}`);
	if (meta.tags?.length) lines.push(`tags: [${meta.tags.map(yamlString).join(', ')}]`);
	if (meta.visibility) lines.push(`visibility: ${meta.visibility}`);
	// Le immagini della colonna a lato vanno nel testo, non qui.
	for (const f of meta.fields ?? []) if (f.label && !f.image) lines.push(`${yamlString(f.label)}: ${yamlString(f.value)}`);
	lines.push('---', '');
	return lines.join('\n');
}
