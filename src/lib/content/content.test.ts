import { describe, expect, it } from 'vitest';
import { extract } from './extract.ts';
import { visibleBlocks } from './blocks.ts';
import type { Visibility } from '../roles.ts';
import { renderDoc, safeHref, type RenderOptions } from './render.ts';
import type { DocNode } from './types.ts';
import { slugify } from '../slug.ts';
import { setRuleLinks } from '../rules/index.ts';

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

// Chi vede quali blocchi: un giocatore non vede i segreti del Master, il Master vede tutto.
const player = (v: Visibility) => v === 'public' || v === 'players';
const master = () => true;

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
	it('visibleBlocks toglie i blocchi segreti a chi non li vede', () => {
		expect(extract(visibleBlocks(doc, player)).hasSecret).toBe(false);
		expect(extract(visibleBlocks(doc, master)).hasSecret).toBe(true);
	});
	it('i blocchi oscurati sono segreti come il vecchio riquadro, anche in un elenco o in un riquadro', () => {
		const ex = extract({
			type: 'doc',
			content: [
				p(txt('Pubblico')),
				{ type: 'paragraph', attrs: { id: 'aaaaaaaa', visibility: 'master' }, content: [txt('Nascosto '), wl('covo')] },
				{ type: 'callout', content: [p(txt('Nota')), { type: 'paragraph', attrs: { visibility: 'master' }, content: [txt('Dentro')] }] }
			]
		});
		expect(ex).toMatchObject({ hasSecret: true, body: 'Pubblico\nNota', secretBody: 'Nascosto covo\nDentro' });
		expect(ex.links).toEqual([{ target: 'covo', secret: true }]);
	});
});

describe('renderDoc', () => {
	it('nasconde i segreti a chi non è Master', () => {
		const html = renderDoc(doc, { sees: player, resolve, labels });
		expect(html).not.toContain('spia');
		expect(html).toContain('<a class="wikilink" href="/wiki/bartolo">Bartolo Pancia</a>');
		expect(html).toContain('class="wikilink missing"');
		expect(html).toContain('il drago');
	});
	it('mostra i segreti al Master; le pagine invisibili restano testo', () => {
		const html = renderDoc(doc, { sees: master, resolve, labels });
		expect(html).toContain('class="secret"');
		expect(html).toContain('<span class="wikilink-hidden">Zhentarim</span>');
	});
	it('i blocchi oscurati di fila stanno in un solo riquadro del segreto', () => {
		const hidden = (text: string): DocNode => ({ type: 'paragraph', attrs: { visibility: 'master' }, content: [txt(text)] });
		const d: DocNode = { type: 'doc', content: [p(txt('A')), hidden('B'), { type: 'image', attrs: { src: '/files/x1', alt: 'C', visibility: 'master' } }, p(txt('D')), hidden('E')] };
		const box = '<aside class="secret" aria-label="Segreto"><p class="secret-title">Segreto</p>';
		expect(renderDoc(d, { sees: master, resolve, labels })).toBe(`<p>A</p>${box}<p>B</p><img src="/files/x1" alt="C" loading="lazy"></aside><p>D</p>${box}<p>E</p></aside>`);
		expect(renderDoc(d, { sees: player, resolve, labels })).toBe('<p>A</p><p>D</p>');
		// Una visibilità che non si capisce vale come segreto.
		expect(renderDoc({ type: 'doc', content: [{ type: 'paragraph', attrs: { visibility: 'boh' }, content: [txt('X')] }] }, { sees: player, resolve, labels })).toBe('');
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
		const html = renderDoc(bad, { sees: player, resolve, labels });
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('iframe');
	});
	it('safeHref', () => {
		expect(safeHref('https://dndbeyond.com')).toBe('https://dndbeyond.com');
		expect(safeHref('/wiki/x')).toBe('/wiki/x');
		expect(safeHref('//evil.com')).toBeNull();
		// La barra rovesciata: per il browser `/\\evil.com` è `//evil.com`.
		expect(safeHref('/\\evil.com')).toBeNull();
		expect(safeHref('/wiki\\evil.com')).toBeNull();
		expect(safeHref('#top')).toBe('#top');
		expect(safeHref('data:text/html,x')).toBeNull();
	});
});

import { imageSize, renderInline, safeImageSrc } from './render.ts';

describe('campi e immagini', () => {
	it('i campi con collegamenti entrano in ricerca e backlink', () => {
		const ex = extract({ type: 'doc', content: [] }, [{ label: 'Residenza', value: '[[Locanda del Grifone|la locanda]]' }]);
		expect(ex.body).toContain('Residenza: la locanda');
		expect(ex.links).toEqual([{ target: 'locanda-del-grifone', secret: false }]);
	});
	it('titoletto e didascalia delle immagini entrano in ricerca', () => {
		const ex = extract({ type: 'doc', content: [] }, [{ label: 'Il mago nella sua torre', value: '', image: 'abc', title: 'Ritratto' }]);
		expect(ex.body).toContain('Ritratto');
		expect(ex.body).toContain('Il mago nella sua torre');
		expect(ex.body).not.toContain(':');
	});
	it('renderInline scappa il testo e crea i link', () => {
		const html = renderInline('<b>Vive a [[Bartolo]]', { resolve, labels });
		expect(html).toBe('&lt;b&gt;Vive a <a class="wikilink" href="/wiki/bartolo">Bartolo Pancia</a>');
	});
	it('immagini sicure', () => {
		expect(safeImageSrc('/files/abc_DEF-1')).toBe('/files/abc_DEF-1');
		expect(safeImageSrc('https://esempio.it/a.png')).toBe('https://esempio.it/a.png');
		expect(safeImageSrc('javascript:alert(1)')).toBeNull();
		expect(safeImageSrc('/files/../x')).toBeNull();
		const html = renderDoc(
			{ type: 'doc', content: [{ type: 'image', attrs: { src: '/files/x1', alt: 'Mappa "vecchia"' } }] },
			{ sees: player, resolve, labels }
		);
		expect(html).toBe('<img src="/files/x1" alt="Mappa &quot;vecchia&quot;" loading="lazy">');
	});
	it('la larghezza di un\'immagine è una parte della colonna, da 10 a 100', () => {
		const img = (size: unknown) => renderDoc({ type: 'doc', content: [{ type: 'image', attrs: { src: '/files/x1', alt: '', size } }] }, { sees: player, resolve, labels });
		expect(img(50)).toBe('<img src="/files/x1" alt="" data-size="50" style="--img-scale:0.5" loading="lazy">');
		// Quello che non è una larghezza non arriva nella pagina: l'immagine resta della sua misura.
		for (const bad of [5, 101, 33.3, '50%', '"><script>', null]) expect(img(bad)).toBe('<img src="/files/x1" alt="" loading="lazy">');
		expect(imageSize('75')).toBe(75);
		expect(imageSize(10)).toBe(10);
	});
});

describe('riferimenti alle regole', () => {
	const ruleLabels = { ...labels, preview: 'Anteprima: {name}', external: '(sito esterno)' };
	const hasRule = (k: string, key: string) => k === 'spell' && key === 'fireball';

	it('nodo dell\'editor: link alla scheda e anteprima se il testo SRD esiste', () => {
		const html = renderDoc(
			{ type: 'doc', content: [p({ type: 'ruleRef', attrs: { kind: 'spell', name: 'Fireball', label: 'Palla di fuoco' } })] },
			{ sees: player, resolve, labels: ruleLabels, hasRule }
		);
		expect(html).toContain('href="/rules/spell/fireball"');
		expect(html).not.toContain('target="_blank"');
		expect(html).toContain('>Palla di fuoco<');
		expect(html).toContain('data-rule="spell/fireball"');
		expect(html).toContain('aria-label="Anteprima: Palla di fuoco"');
	});

	it('con un plugin di link acceso il riferimento porta al sito esterno', () => {
		setRuleLinks([{ site: 'Sito', url: 'https://sito.test/?a=1&q={name}' }]);
		const html = renderInline('@incantesimo[Mage Armor] e @mostro[Beholder]', { resolve, labels: ruleLabels, hasRule });
		setRuleLinks([]);
		expect(html).toContain('href="https://sito.test/?a=1&amp;q=Mage%20Armor"');
		expect(html).toContain('href="https://sito.test/?a=1&amp;q=Beholder"');
		expect(html).toContain('(sito esterno)');
	});

	it('senza plugin, una voce che non esiste resta testo', () => {
		const html = renderInline('@mostro[Beholder|il tiranno]', { resolve, labels: ruleLabels, hasRule });
		expect(html).toBe('<span class="ruleref">il tiranno</span>');
	});

	it('nel testo semplice, con alias italiani; niente anteprima se manca il testo', () => {
		const html = renderInline('Lancia @incantesimo[Fireball] e poi @mostro[Beholder|il tiranno]. @sconosciuto[X]', { resolve, labels: ruleLabels, hasRule });
		expect(html).toContain('data-rule="spell/fireball"');
		expect(html).toContain('>il tiranno<');
		expect(html).not.toContain('data-rule="monster/beholder"');
		expect(html).toContain('@sconosciuto[X]');
	});

	it('i riferimenti contano come collegamenti e come testo', () => {
		const ex = extract(
			{ type: 'doc', content: [p({ type: 'ruleRef', attrs: { kind: 'condition', name: 'Prone' } })] },
			[{ label: 'Incantesimo preferito', value: '@spell[Fireball|Palla di fuoco]' }]
		);
		expect(ex.links.map((l) => l.target).sort()).toEqual(['@condition/prone', '@spell/fireball']);
		expect(ex.body).toContain('Palla di fuoco');
		expect(ex.body).toContain('Prone');
	});
});
