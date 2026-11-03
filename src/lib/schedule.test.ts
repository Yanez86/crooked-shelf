import { describe, expect, it } from 'vitest';
import { endsAt, monthGrid, occurrences, sessionStatus, shiftDay, shiftMonth, starWishSession, webLink, type Series, type Status } from './schedule.ts';

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

	it('Stars & Wishes: l\'ultima sessione finita, fino al giorno di quella dopo', () => {
		const at = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();
		const s = (date: string, status: Status | null = null) => ({ date, starts: '20:00', ends: '00:00', status });
		const items = [s('2026-11-05'), s('2026-11-12', 'cancelled'), s('2026-11-19')];
		// Finisce dopo mezzanotte: il 5 alle 23 non è ancora finita, il 6 sì.
		expect(endsAt('2026-11-05', '20:00', '00:00')).toBe(new Date(2026, 10, 6, 0, 0).getTime());
		expect(starWishSession(items, at(5, 23))).toBeNull();
		expect(starWishSession(items, at(6))?.date).toBe('2026-11-05');
		// Quella saltata non conta: le domande sul 5 restano fino al 19, il giorno della sessione dopo.
		expect(starWishSession(items, at(13))?.date).toBe('2026-11-05');
		expect(starWishSession(items, at(19))).toBeNull();
		// Senza una sessione dopo, restano aperte.
		expect(starWishSession(items, at(25))?.date).toBe('2026-11-19');
		expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('solo link web', () => {
		expect(webLink('https://discord.gg/abc')).toBe('https://discord.gg/abc');
		expect(webLink('javascript:alert(1)')).toBeNull();
		expect(webLink('discord')).toBeNull();
	});
});
