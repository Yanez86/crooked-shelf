import type { DocNode, PageField } from './types.ts';

export interface MarkdownOptions {
	/** Includere i blocchi segreti (come callout "secret"). */
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

function block(n: DocNode, o: MarkdownOptions): string[] {
	const kids = (n.content ?? []).flatMap((c, i, all) => {
		const lines = block(c, o);
		return i < all.length - 1 ? [...lines, ''] : lines;
	});
	switch (n.type) {
		case 'doc':
			return kids;
		case 'paragraph':
			return [inline(n.content, o)];
		case 'heading':
			return ['#'.repeat(Math.min(6, Math.max(1, Number(n.attrs?.level) || 2))) + ' ' + inline(n.content, o)];
		case 'blockquote':
			return kids.map((l) => (l ? `> ${l}` : '>'));
		case 'callout':
		case 'secret': {
			if (n.type === 'secret' && !o.secrets) return [];
			const kind = n.type === 'secret' ? 'secret' : String(n.attrs?.kind ?? 'note');
			return [`> [!${kind}]`, ...kids.map((l) => (l ? `> ${l}` : '>'))];
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

const yamlString = (s: string) => JSON.stringify(s);

/** Intestazione YAML con titolo, categoria, tag, campi della scheda. */
export function frontMatter(meta: { title: string; category?: string | null; tags?: string[]; visibility?: string; fields?: PageField[] }): string {
	const lines = ['---', `title: ${yamlString(meta.title)}`];
	if (meta.category) lines.push(`category: ${yamlString(meta.category)}`);
	if (meta.tags?.length) lines.push(`tags: [${meta.tags.map(yamlString).join(', ')}]`);
	if (meta.visibility) lines.push(`visibility: ${meta.visibility}`);
	for (const f of meta.fields ?? []) if (f.label) lines.push(`${yamlString(f.label)}: ${yamlString(f.value)}`);
	lines.push('---', '');
	return lines.join('\n');
}
