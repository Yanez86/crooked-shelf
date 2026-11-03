import { describe, expect, it } from 'vitest';
import { monthGrid, occurrences, sessionStatus, shiftMonth, webLink, type Series } from './schedule.ts';

const s = (date: string, repeat: Series['repeat'], until: string | null = null, skips: string[] = []): Series => ({ date, repeat, until, skips });

describe('appuntamenti', () => {
	it('una volta sola: solo nel suo mese', () => {
		expect(occurrences(s('2026-11-05', 'none'), '2026-11-01', '2026-11-30')).toEqual(['2026-11-05']);
		expect(occurrences(s('2026-11-05', 'none'), '2026-12-01', '2026-12-31')).toEqual([]);
	});

	it('ogni settimana, dalla prima data in poi, senza le date annullate', () => {
		expect(occurrences(s('2026-11-05', 'week', null, ['2026-11-19']), '2026-11-01', '2026-11-30')).toEqual(['2026-11-05', '2026-11-12', '2026-11-26']);
		expect(occurrences(s('2026-11-05', 'week'), '2026-12-01', '2026-12-31')).toEqual(['2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24', '2026-12-31']);
		expect(occurrences(s('2026-11-05', 'week'), '2026-10-01', '2026-10-31')).toEqual([]);
	});

	it('ogni 2 settimane e fino a una data', () => {
		expect(occurrences(s('2026-11-05', '2weeks', '2026-12-10'), '2026-11-01', '2026-12-31')).toEqual(['2026-11-05', '2026-11-19', '2026-12-03']);
		// Da un mese che parte a metà del passo.
		expect(occurrences(s('2026-11-05', '2weeks'), '2026-12-01', '2026-12-31')).toEqual(['2026-12-03', '2026-12-17', '2026-12-31']);
	});

	it('ogni mese: lo stesso giorno della settimana nella stessa posizione', () => {
		// 5 novembre 2026 è il primo giovedì.
		expect(occurrences(s('2026-11-05', 'month'), '2026-11-01', '2027-02-28')).toEqual(['2026-11-05', '2026-12-03', '2027-01-07', '2027-02-04']);
		// Il quinto giovedì di ottobre: a novembre e dicembre non c'è.
		expect(occurrences(s('2026-10-29', 'month'), '2026-10-01', '2026-12-31')).toEqual(['2026-10-29', '2026-12-31']);
	});

	it('griglia del mese dal lunedì', () => {
		const g = monthGrid('2026-11');
		expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
		expect(g.at(-1)).toEqual(['2026-11-30', null, null, null, null, null, null]);
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
	});

	it('la regola del minimo: confermata, in forse, salta', () => {
		const rule = { min: 3, hours: 24 };
		const now = new Date(2026, 10, 3, 20, 0).getTime();
		expect(sessionStatus('2026-11-05', '20:00', 1, { min: 0, hours: 24 }, now)).toBeNull();
		expect(sessionStatus('2026-11-05', '20:00', 3, rule, now)).toBe('confirmed');
		expect(sessionStatus('2026-11-05', '20:00', 2, rule, now)).toBe('pending');
		expect(sessionStatus('2026-11-04', '19:00', 2, rule, now)).toBe('cancelled');
	});

	it('solo link web', () => {
		expect(webLink('https://discord.gg/abc')).toBe('https://discord.gg/abc');
		expect(webLink('javascript:alert(1)')).toBeNull();
		expect(webLink('discord')).toBeNull();
	});
});
