import { describe, expect, it } from 'vitest';
import { LOCALES, translate, fromAcceptLanguage, type Dict } from './index.ts';

function keys(d: Dict, prefix = ''): string[] {
	return Object.entries(d).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keys(v, prefix + k + '.')));
}

describe('traduzioni', () => {
	it('italiano e inglese hanno le stesse chiavi', () => {
		expect(keys(LOCALES.it).sort()).toEqual(keys(LOCALES.en).sort());
	});
	it('parametri e lingua di riserva', () => {
		expect(translate('it', 'nonexistent.key')).toBe('nonexistent.key');
		expect(fromAcceptLanguage('it-IT,it;q=0.9,en;q=0.8')).toBe('it');
		expect(fromAcceptLanguage('de-DE')).toBeNull();
	});
});
