import { describe, expect, it } from 'vitest';
import { cleanCover, coverY } from './covers.ts';

const known = (id: string) => (id === 'ok' ? 'ok' : null);

describe('copertina della pagina', () => {
	it('la posizione è un intero tra 0 e 100, al centro se manca', () => {
		expect(coverY('30')).toBe(30);
		expect(coverY(42.6)).toBe(43);
		expect(coverY(-5)).toBe(0);
		expect(coverY('250')).toBe(100);
		expect(coverY('')).toBe(50);
		expect(coverY('alto')).toBe(50);
		expect(coverY(null)).toBe(50);
	});

	it("vince l'immagine; un colore sconosciuto o un file che non c'è non fanno copertina", () => {
		expect(cleanCover({ image: 'ok', color: 'night', y: '20' }, known)).toEqual({ image: 'ok', color: null, y: 20 });
		expect(cleanCover({ image: 'sparito', color: 'night', y: '20' }, known)).toEqual({ image: null, color: 'night', y: 50 });
		expect(cleanCover({ image: '', color: 'fucsia' }, known)).toBeNull();
		expect(cleanCover({ color: 'toString' }, known)).toBeNull();
		expect(cleanCover(null, known)).toBeNull();
	});
});
