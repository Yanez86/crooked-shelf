import { describe, expect, it } from 'vitest';
import { extract, stripSecrets } from './extract.ts';
import { renderDoc, safeHref, type RenderOptions } from './render.ts';
import type { DocNode } from './types.ts';
import { slugify } from '../slug.ts';

const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });
const txt = (text: string, marks?: DocNode['marks']): DocNode => ({ type: 'text', text, marks });
const wl = (target: string, title = target, label?: string): DocNode => ({
	type: 'wikiLink',
	attrs: { target, title, label }
});

const doc: DocNode = {
	type: 'doc',
	content: [
		p(txt('La locanda di '), wl('bartolo', 'Bartolo'), txt('.')),
		{ type: 'secret', content: [p(txt('Bartolo è una spia di '), wl('zhentarim', 'Zhentarim'))] },
		p(wl('drago-rosso', 'Drago rosso', 'il drago'))
	]
};

const labels: RenderOptions['labels'] = {
	secret: 'Segreto',
	note: 'Nota',
	tip: 'Consiglio',
	warning: 'Attenzione',
	missing: 'pagina da creare'
};

const resolve = (s: string) =>
	({ bartolo: { title: 'Bartolo Pancia', visible: true }, zhentarim: { title: 'Zhentarim', visible: false } })[s];

describe('slugify', () => {
	it('toglie accenti e simboli', () => {
		expect(slugify('Città di Neverwinter!')).toBe('citta-di-neverwinter');
		expect(slugify("L'Ordine del Guanto")).toBe('lordine-del-guanto');
		expect(slugify('   ')).toBe('page');
	});
});

describe('extract', () => {
	it('separa testo pubblico e segreto e trova i collegamenti', () => {
		const ex = extract(doc);
		expect(ex.hasSecret).toBe(true);
		expect(ex.body).toContain('La locanda di Bartolo');
		expect(ex.body).not.toContain('spia');
		expect(ex.secretBody).toContain('spia');
		expect(ex.links).toEqual([
			{ target: 'bartolo', secret: false },
			{ target: 'zhentarim', secret: true },
			{ target: 'drago-rosso', secret: false }
		]);
	});
	it('stripSecrets toglie i blocchi segreti', () => {
		expect(extract(stripSecrets(doc)).hasSecret).toBe(false);
	});
});

describe('renderDoc', () => {
	it('nasconde i segreti a chi non è Master', () => {
		const html = renderDoc(doc, { showSecrets: false, resolve, labels });
		expect(html).not.toContain('spia');
		expect(html).toContain('<a class="wikilink" href="/wiki/bartolo">Bartolo Pancia</a>');
		expect(html).toContain('class="wikilink missing"');
		expect(html).toContain('il drago');
	});
	it('mostra i segreti al Master; le pagine invisibili restano testo', () => {
		const html = renderDoc(doc, { showSecrets: true, resolve, labels });
		expect(html).toContain('class="secret"');
		expect(html).toContain('<span class="wikilink-hidden">Zhentarim</span>');
	});
	it('scappa l\'HTML e blocca i link pericolosi', () => {
		const bad: DocNode = {
			type: 'doc',
			content: [
				p(txt('<script>alert(1)</script>')),
				p(txt('clic', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])),
				{ type: 'iframe', attrs: { src: 'x' } }
			]
		};
		const html = renderDoc(bad, { showSecrets: false, resolve, labels });
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('iframe');
	});
	it('safeHref', () => {
		expect(safeHref('https://dndbeyond.com')).toBe('https://dndbeyond.com');
		expect(safeHref('/wiki/x')).toBe('/wiki/x');
		expect(safeHref('//evil.com')).toBeNull();
		expect(safeHref('data:text/html,x')).toBeNull();
	});
});
