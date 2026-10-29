import { describe, expect, it } from 'vitest';
import { dayNumber, formatDate, fromText, isLeap, preset, toText, validDate, weekday, yearDays } from './calendar.ts';

const greg = preset('gregorian', 'it');
const harptos = preset('harptos', 'it');

describe('calendario gregoriano', () => {
	it('anni bisestili', () => {
		expect(isLeap(greg, 2024)).toBe(true);
		expect(isLeap(greg, 2023)).toBe(false);
		expect(isLeap(greg, 1900)).toBe(false);
		expect(isLeap(greg, 2000)).toBe(true);
		expect(yearDays(greg, 2024)).toBe(366);
	});
	it('giorni consecutivi e settimana', () => {
		const a = dayNumber(greg, { year: 2024, month: 2, day: 29 });
		const b = dayNumber(greg, { year: 2024, month: 3, day: 1 });
		expect(b - a).toBe(1);
		expect(dayNumber(greg, { year: 2025, month: 1, day: 1 }) - dayNumber(greg, { year: 2024, month: 1, day: 1 })).toBe(366);
		// 29 ottobre 2026 è un giovedì.
		expect(weekday(greg, { year: 2026, month: 10, day: 29 })).toBe('Giovedì');
		expect(weekday(greg, { year: 2000, month: 1, day: 1 })).toBe('Sabato');
	});
	it('anni negativi in ordine', () => {
		expect(dayNumber(greg, { year: -1, month: 12, day: 31 }) + 1).toBe(dayNumber(greg, { year: 0 }));
		expect(dayNumber(greg, { year: -500 })).toBeLessThan(dayNumber(greg, { year: -499 }));
	});
	it('date valide', () => {
		expect(validDate(greg, { year: 2023, month: 2, day: 29 })).toBe(false);
		expect(validDate(greg, { year: 2024, month: 2, day: 29 })).toBe(true);
		expect(validDate(greg, { year: 2024, month: 13 })).toBe(false);
		expect(validDate(greg, { year: 2024, day: 3 })).toBe(false);
		expect(formatDate(greg, { year: 1492, month: 10, day: 12 })).toBe('12 Ottobre 1492 d.C.');
	});
});

describe('Harptos', () => {
	it('feste e Shieldmeet', () => {
		expect(yearDays(harptos, 1491)).toBe(365);
		expect(yearDays(harptos, 1492)).toBe(366);
		expect(formatDate(harptos, { year: 1491, month: 2, day: 1 })).toBe('Midwinter 1491 DR');
		expect(formatDate(harptos, { year: 1491, month: 7, day: 15 })).toBe('15 Mirtul 1491 DR');
		expect(validDate(harptos, { year: 1492, month: 10, day: 2 })).toBe(true);
		expect(validDate(harptos, { year: 1491, month: 10, day: 2 })).toBe(false);
	});
});

describe('calendario come testo', () => {
	it('andata e ritorno', () => {
		for (const c of [greg, harptos, preset('simple', 'en')]) {
			const r = fromText(toText(c));
			expect(r.ok && r.cal).toEqual(c);
		}
	});
	it('errori con il numero di riga', () => {
		const t = toText(greg);
		expect(fromText({ ...t, months: 'Gennaio: 31\nFebbraio' })).toEqual({ ok: false, error: 'calendar.errMonth', line: 2 });
		expect(fromText({ ...t, leapMonth: '99' })).toMatchObject({ ok: false, error: 'calendar.errLeap' });
		expect(fromText({ ...t, todayYear: '2023', todayMonth: '2', todayDay: '30' })).toMatchObject({ ok: false });
	});
});
