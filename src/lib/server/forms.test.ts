import { describe, expect, it } from 'vitest';
import { safeNext } from './forms.ts';

describe('safeNext', () => {
	it('accetta solo percorsi interni', () => {
		expect(safeNext('/wiki/x?a=1')).toBe('/wiki/x?a=1');
		expect(safeNext('/campaign')).toBe('/campaign');
		expect(safeNext(null)).toBe('/');
		expect(safeNext('')).toBe('/');
		expect(safeNext('/login?next=/x')).toBe('/');
		expect(safeNext('https://evil.com')).toBe('/');
		expect(safeNext('//evil.com')).toBe('/');
	});
	it('la barra rovesciata non porta fuori (il browser la legge come barra)', () => {
		expect(safeNext('/\\evil.com')).toBe('/');
		expect(safeNext('/\\\\evil.com')).toBe('/');
		expect(safeNext('/%5Cevil.com')).toBe('/');
		expect(safeNext('/%5cevil.com')).toBe('/');
		expect(safeNext('/wiki\\evil.com')).toBe('/');
		expect(safeNext('/wiki/x#frag')).toBe('/wiki/x');
	});
});
