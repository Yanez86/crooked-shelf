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
