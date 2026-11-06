import { describe, expect, it } from 'vitest';
import { frontMatter, toMarkdown, fromMarkdown } from './markdown.ts';
import type { DocNode } from './types.ts';

const t = (text: string, marks?: DocNode['marks']): DocNode => ({ type: 'text', text, marks });
const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });

const doc: DocNode = {
	type: 'doc',
	content: [
		{ type: 'heading', attrs: { level: 2 }, content: [t('Descrizione')] },
		p(t('Il proprietario è '), { type: 'wikiLink', attrs: { target: 'bartolo', title: 'Bartolo' } }, t(' e serve '), t('birra', [{ type: 'bold' }]), t('.')),
		{ type: 'bulletList', content: [{ type: 'listItem', content: [p(t('uno'))] }, { type: 'listItem', content: [p(t('due'))] }] },
		{ type: 'secret', content: [p(t('È una spia.'))] },
		{ type: 'callout', attrs: { kind: 'tip' }, content: [p(t('Ordina lo stufato.'))] },
		p({ type: 'ruleRef', attrs: { kind: 'spell', name: 'Fireball', label: 'Palla di fuoco' } }),
		{ type: 'image', attrs: { src: '/files/abc', alt: 'Insegna' } },
		{
			type: 'table',
			content: [
				{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('Piatto'))] }, { type: 'tableHeader', content: [p(t('Prezzo'))] }] },
				{ type: 'tableRow', content: [{ type: 'tableCell', content: [p(t('Stufato'))] }, { type: 'tableCell', content: [p(t('3 mo'))] }] }
			]
		}
	]
};

describe('Markdown', () => {
	it('converte i blocchi principali', () => {
		const md = toMarkdown(doc, { secrets: false, titleOf: (s) => (s === 'bartolo' ? 'Bartolo Pancia' : null), imagePath: (s) => `_files/${s.slice(7)}.png` });
		expect(md).toContain('## Descrizione');
		expect(md).toContain('Il proprietario è [[Bartolo Pancia]] e serve **birra**.');
		expect(md).toContain('- uno\n- due');
		expect(md).not.toContain('spia');
		expect(md).toContain('> [!tip]\n> Ordina lo stufato.');
		expect(md).toContain('@spell[Fireball|Palla di fuoco]');
		expect(md).toContain('![Insegna](_files/abc.png)');
		expect(md).toContain('| Piatto | Prezzo |\n| --- | --- |\n| Stufato | 3 mo |');
	});
	it('i segreti solo se richiesti', () => {
		expect(toMarkdown(doc, { secrets: true, titleOf: () => null })).toContain('> [!secret]\n> È una spia.');
	});
	it('intestazione YAML', () => {
		expect(frontMatter({ title: 'A "B"', tags: ['x'], fields: [{ label: 'Età', value: '40' }] })).toBe('---\ntitle: "A \\"B\\""\ntags: ["x"]\n"Età": "40"\n---\n');
	});
});

describe('fromMarkdown', () => {
	const types = (text: string) => fromMarkdown(text).map((n) => n.type);

	it('blocchi: titoli ai livelli dell\'editor, elenchi, citazioni, righe', () => {
		expect(types('## A\n\ntesto\nsu due righe\n\n- uno\n- due\n\n1. primo\n\n> detto\n\n---')).toEqual(['heading', 'paragraph', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule']);
		expect(fromMarkdown('# A')[0].attrs?.level).toBe(2);
		expect(fromMarkdown('###### A')[0].attrs?.level).toBe(4);
		expect(fromMarkdown('testo\nsu due righe')[0].content?.[0].text).toBe('testo su due righe');
		expect(fromMarkdown('- uno\n- due')[0].content).toHaveLength(2);
	});

	it('collegamenti e regole come nell\'editor', () => {
		const [a, , b] = fromMarkdown('[[Città di Neverwinter|la città]] @incantesimo[Fireball]')[0].content!;
		expect(a).toEqual({ type: 'wikiLink', attrs: { target: 'citta-di-neverwinter', title: 'Città di Neverwinter', label: 'la città' } });
		expect(b).toEqual({ type: 'ruleRef', attrs: { kind: 'spell', name: 'Fireball', label: null } });
		expect(fromMarkdown('@boh[x]')[0].content).toEqual([{ type: 'text', text: '@boh[x]' }]);
	});

	it('niente che non sia nella lista: HTML, script nei link, immagini', () => {
		const text = (s: string) => JSON.stringify(fromMarkdown(s));
		expect(fromMarkdown('<script>alert(1)</script>')).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }]);
		expect(text('[x](javascript:alert(1))')).not.toContain('"link"');
		expect(text('[x](/logout)')).not.toContain('"link"');
		expect(text('![x](https://esempio.it/a.png)')).not.toContain('"image"');
		expect(fromMarkdown('[x](https://esempio.it)')[0].content?.[0].marks).toEqual([{ type: 'link', attrs: { href: 'https://esempio.it' } }]);
		expect(fromMarkdown('**forte *e storto***')[0].content?.[0].marks?.[0].type).toBe('bold');
	});

	it('tabelle: la prima riga è l\'intestazione, ogni riga ha le colonne dell\'intestazione', () => {
		const md = 'Gli stadi:\n| Follia | Stadio |\n|---|:---:|\n| 0–4 | **Lucido** |\n| 5–9 |\n| 10 | Incrinato | in più |\n\nDopo.';
		expect(types(md)).toEqual(['paragraph', 'table', 'paragraph']);
		const rows = fromMarkdown(md)[1].content!;
		const texts = rows.map((r) => r.content!.map((c) => c.content![0].content?.map((n) => n.text).join('') ?? ''));
		expect(texts).toEqual([
			['Follia', 'Stadio'],
			['0–4', 'Lucido'],
			['5–9', ''],
			['10', 'Incrinato']
		]);
		expect(rows.map((r) => r.content![0].type)).toEqual(['tableHeader', 'tableCell', 'tableCell', 'tableCell']);
		expect(rows[1].content![1].content![0].content![0].marks).toEqual([{ type: 'bold' }]);
		expect(rows[2].content![1]).toEqual({ type: 'tableCell', content: [{ type: 'paragraph' }] });
	});

	it('tabelle: senza | ai lati, con \\| nel testo e coi | dei collegamenti', () => {
		const [t] = fromMarkdown('A | B\n--- | ---\n[[Città di Neverwinter|la città]] | uno \\| due');
		const [link, text] = t.content![1].content!.map((c) => c.content![0].content![0]);
		expect(link).toMatchObject({ type: 'wikiLink', attrs: { title: 'Città di Neverwinter', label: 'la città' } });
		expect(text.text).toBe('uno | due');
	});

	it('senza la riga dei trattini, o con colonne diverse, non è una tabella', () => {
		expect(types('| a | b |\n| c | d |')).toEqual(['paragraph']);
		expect(types('| a | b |\n|---|')).toEqual(['paragraph']);
		expect(types('|\n|---|')).toEqual(['paragraph']);
	});

	it('un testo lunghissimo fatto apposta non blocca il server', () => {
		const start = Date.now();
		fromMarkdown('['.repeat(100_000));
		fromMarkdown('*'.repeat(100_000));
		fromMarkdown('> '.repeat(50_000));
		fromMarkdown('|'.repeat(100_000));
		fromMarkdown(`${'|a'.repeat(20)}|\n${'|-'.repeat(20)}|\n${'|\n'.repeat(50_000)}`);
		expect(Date.now() - start).toBeLessThan(2000);
	});

	it('una tabella fatta apposta non diventa enorme', () => {
		const [t] = fromMarkdown(`${'|a'.repeat(20)}|\n${'|-'.repeat(20)}|\n${'|\n'.repeat(50_000)}`);
		expect(t.type).toBe('table');
		expect(t.content!.length * 20).toBeLessThanOrEqual(10_000);
	});

	it('non crea mai nodi di testo vuoti, che l\'editor rifiuta', () => {
		const empty = (n: { text?: string; type: string; content?: never[] }): boolean => (n.type === 'text' && !n.text) || (n.content ?? []).some(empty);
		for (const s of ['****', '** **', '*', '> ', '# **', '- [[ ]]', '| ** | [[ ]] |\n|---|---|\n| | ** |']) expect(fromMarkdown(s).some(empty as never)).toBe(false);
	});
});
