import { describe, expect, it } from 'vitest';
import { frontMatter, toMarkdown } from './markdown.ts';
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
