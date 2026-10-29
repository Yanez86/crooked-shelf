import { describe, expect, it } from 'vitest';
import { THEMES, contrastProblems, contrast } from './themes.ts';

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
});
