import { describe, expect, it } from 'vitest';
import { THEMES, checkTheme, contrastProblems, contrast, themeCss } from './themes.ts';

describe('temi', () => {
	it('calcola il contrasto come WCAG', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
		expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
	});
	for (const t of THEMES) {
		it(`il tema ${t.id} rispetta i contrasti WCAG AA`, () => {
			expect(contrastProblems(t)).toEqual([]);
		});
	}
	// Aria mette le barre su surface2 e mescola alcuni colori in styles/aria.css (color-mix in srgb): anche quelli restano leggibili.
	describe('Aria: barre e colori mescolati', () => {
		const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
		const mix = (a: string, p: number, b: string) =>
			'#' + hex(a).map((x, i) => Math.round(x * p + hex(b)[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
		for (const id of ['aria', 'aria-dark']) {
			const c = THEMES.find((t) => t.id === id)!.colors;
			const hover = mix(c.text, 0.07, c.surface2);
			const pairs: [string, string, string, number][] = [
				['testo spento sulla barra', c.muted, c.surface2, 4.5],
				['collegamento sulla barra', c.link, c.surface2, 4.5],
				['colore principale sulla barra', c.primary, c.surface2, 4.5],
				['bordo dei campi sulla barra', c.control, c.surface2, 3],
				['fuoco sulla barra', c.focus, c.surface2, 3],
				['testo sulla riga sotto il puntatore', c.text, hover, 4.5],
				['testo spento sulla riga sotto il puntatore', c.muted, hover, 4.5],
				['pagina aperta nell’albero', c.primary, mix(c.primary, 0.12, c.surface2), 4.5],
				['numero dell’elenco', c.primary, mix(c.primary, 0.12, c.bg), 4.5],
				['testo nella nota', c.text, mix(c.noteBorder, 0.1, c.surface), 4.5],
				['collegamento nella nota', c.link, mix(c.noteBorder, 0.1, c.surface), 4.5],
				['collegamento nel consiglio', c.link, mix(c.tipBorder, 0.1, c.surface), 4.5],
				['collegamento nell’avvertenza', c.link, mix(c.warningBorder, 0.12, c.surface), 4.5]
			];
			for (const [what, fg, bg, min] of pairs) {
				it(`${id}: ${what}`, () => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min));
			}
		}
	});
	it('lo sfondo finisce nel CSS solo per il suo tema', () => {
		const css = themeCss([{ ...THEMES[1], id: 'custom-1', background: 'abcdefghij' }]);
		expect(css).toContain(':root[data-theme="custom-1"]{');
		expect(css.match(/--bg-image:url\(\/files\/abcdefghij\)/g)).toHaveLength(1);
	});
	it('un tema importato non porta lo sfondo nel CSS', () => {
		const r = checkTheme({ ...THEMES[1], background: 'x)}</style><script>' });
		expect(r.ok && r.theme.background).toBeUndefined();
	});
});
