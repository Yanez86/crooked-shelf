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
	// Il modello Aria (Aria, Aria di notte, Neon) mette le barre su surface2 e mescola alcuni colori in styles/aria.css e
	// styles/neon.css (color-mix in srgb): anche quelli restano leggibili.
	describe('modello Aria: barre e colori mescolati', () => {
		const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
		const mix = (a: string, p: number, b: string) =>
			'#' + hex(a).map((x, i) => Math.round(x * p + hex(b)[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
		for (const id of ['aria', 'aria-dark', 'neon']) {
			const c = THEMES.find((t) => t.id === id)!.colors;
			// La riga sotto il puntatore (--aria-hover): nel Neon è tinta di viola.
			const hover = id === 'neon' ? mix('#8b5cff', 0.16, c.surface2) : mix(c.text, 0.07, c.surface2);
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
		// I menu sopra le barre (profilo, «chi può vedere»): fondo, riga sotto il puntatore e bordo (--aria-pop* in aria.css e neon.css).
		const pops: [string, string, string, string][] = [
			['aria', THEMES[0].colors.surface, THEMES[0].colors.surface2, THEMES[0].colors.border],
			['aria-dark', mix(THEMES[1].colors.text, 0.09, THEMES[1].colors.surface), mix(THEMES[1].colors.text, 0.14, THEMES[1].colors.surface), mix(THEMES[1].colors.text, 0.2, THEMES[1].colors.surface)],
			['neon', THEMES[2].colors.bg, mix('#8b5cff', 0.2, THEMES[2].colors.bg), mix('#ff3db8', 0.55, THEMES[2].colors.border)]
		];
		for (const [id, pop, hover] of pops) {
			it(`${id}: testi leggibili nei menu, anche sulla riga sotto il puntatore`, () => {
				const c = THEMES.find((t) => t.id === id)!.colors;
				for (const bg of [pop, hover]) {
					expect(contrast(c.text, bg)).toBeGreaterThanOrEqual(4.5);
					expect(contrast(c.muted, bg)).toBeGreaterThanOrEqual(4.5);
				}
			});
		}
		it('i temi delle prove sono nell\'ordine atteso', () => expect(THEMES.slice(0, 3).map((t) => t.id)).toEqual(['aria', 'aria-dark', 'neon']));
		// Nel Neon il testo del centro sta sul fondale (styles/neon.css): il punto più chiaro è dove l'alone viola, una linea
		// della griglia, la banda che scende e una scanline si sommano. Le intensità sono quelle del CSS.
		it('neon: ogni testo resta leggibile sul fondale, anche nel punto più chiaro', () => {
			const c = THEMES.find((t) => t.id === 'neon')!.colors;
			let worst = c.bg;
			worst = mix('#8b5cff', 0.08, worst);
			worst = mix('#ff3db8', 0.08, worst);
			worst = mix('#3ee8ff', 0.04, worst);
			worst = mix('#ffffff', 0.025, worst);
			for (const k of ['text', 'muted', 'link', 'primary', 'missing', 'danger', 'success'] as const) {
				expect(contrast(c[k], worst), k).toBeGreaterThanOrEqual(4.5);
			}
		});
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
