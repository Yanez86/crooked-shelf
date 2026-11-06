import { describe, expect, it } from 'vitest';
import { dayNumber, preset } from './calendar.ts';
import { GEOM, averageYear, dateOfDay, fitPpu, isoOfDay, layoutLine, realDay, realTicks, ticksFor, worldTicks, yearOfDay } from './timelineScale.ts';

const harptos = preset('harptos', 'it');
const day = (year: number, month?: number, d?: number) => dayNumber(harptos, { year, month: month ?? null, day: d ?? null });
const items = (ts: number[]) => ts.map((t, i) => ({ id: i + 1, t }));

describe('linea del tempo in scala', () => {
	it('mette gli eventi in scala e accorcia i salti lunghi, dicendo quanto coprono', () => {
		const ppu = 0.5;
		const l = layoutLine(items([day(1480), day(1481), day(1491)]), ppu);
		const [a, b, c] = l.cards;
		// Il 1480 ha Shieldmeet: 366 giorni.
		expect(b.x - a.x).toBeCloseTo(366 * ppu);
		// 10 anni a 0,5 px al giorno sarebbero 1825 px: diventano maxGap, e il salto è segnato.
		expect(c.x - b.x).toBe(GEOM.maxGap);
		expect(l.gaps).toHaveLength(1);
		expect(l.gaps[0].days).toBe(day(1491) - day(1481));
	});

	it('mette le schede vicine su corsie diverse, e le sposta in avanti quando sono tutte occupate', () => {
		const same = day(1491, 7, 15);
		const l = layoutLine(items([same, same, same, same]), 1);
		expect(l.cards.map((c) => c.lane)).toEqual([0, 1, 2, 0]);
		expect(l.cards[3].x - l.cards[0].x).toBe(GEOM.cardW + GEOM.sep);
		// Le corsie più alte stanno più in alto, e nessuna scheda copre l'asse.
		expect(l.cards[1].top).toBeLessThan(l.cards[0].top);
		for (const c of l.cards) expect(c.bottom).toBeLessThan(l.axisY);
	});

	it('mantiene l\'ordine: le posizioni non tornano mai indietro', () => {
		const ts = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 400, 401, 402, 403, 404, 405].map((d) => d * 10);
		const l = layoutLine(items(ts), 2);
		for (let i = 1; i < l.cards.length; i++) expect(l.cards[i].x).toBeGreaterThanOrEqual(l.cards[i - 1].x);
	});

	it('converte avanti e indietro tra date e pixel', () => {
		const l = layoutLine(items([100, 200, 5000]), 1, 2000);
		for (const t of [100, 150, 200, 3000, 5000]) expect(l.tOf(l.xOf(t))).toBeCloseTo(t);
		expect(l.xOf(150)).toBeCloseTo((l.cards[0].x + l.cards[1].x) / 2);
		expect(l.width).toBe(2000);
	});

	it('«Adatta» trova lo zoom con cui tutto sta nello spazio visibile', () => {
		const list = items([day(714), day(1032), day(1358), day(1385), day(1491)]);
		const ppu = fitPpu(list, 1100, 1e-6, 30);
		expect(layoutLine(list, ppu, 1100).natural).toBeLessThanOrEqual(1100);
		expect(layoutLine(list, ppu * 1.1, 1100).natural).toBeGreaterThan(1100);
		// Anche con pochi eventi lontani resta spazio per avvicinarsi: i salti si accorciano solo oltre il 60%.
		const few = items([day(714), day(1490, 2), day(1491, 7, 15)]);
		const fit = fitPpu(few, 700, 1e-6, 30);
		expect(fit).toBeLessThan(30);
		const l = layoutLine(few, fit, 700);
		expect(l.cards[1].x - l.cards[0].x).toBeCloseTo(700 * GEOM.maxGapShare);
		expect(l.gaps).toHaveLength(1);
		// Se le schede non ci stanno comunque, la striscia si allunga poco oltre il minimo, ma resta in scala.
		const floor = layoutLine(list, 1e-6, 300).natural;
		const tight = fitPpu(list, 300, 1e-6, 30);
		expect(tight).toBeGreaterThan(1e-6);
		expect(layoutLine(list, tight, 300).natural).toBeLessThanOrEqual(floor * 1.15);
	});
});

describe('date del calendario', () => {
	it('trova l\'anno e la data di un giorno, anche con gli anni bisestili', () => {
		for (const d of [
			{ year: 1491, month: 7, day: 15 },
			{ year: 1492, month: 11, day: 1 },
			{ year: -40, month: 1, day: 1 },
			{ year: 1488, month: 17, day: 30 }
		]) {
			const n = dayNumber(harptos, d);
			expect(yearOfDay(harptos, n)).toBe(d.year);
			expect(dateOfDay(harptos, n)).toEqual(d);
		}
	});

	it('l\'anno medio conta i bisestili', () => {
		expect(averageYear(harptos)).toBe(365.25);
		expect(averageYear(preset('gregorian', 'it'))).toBe(365.2425);
	});

	it('da lontano mostra gli anni a passi tondi, da vicino i mesi', () => {
		const gen = worldTicks(harptos);
		const far = gen(day(1000), day(1500), 0.002);
		expect(far.length).toBeGreaterThan(0);
		expect(far.every((t) => Number(t.label) % 100 === 0)).toBe(true);
		const near = gen(day(1491), day(1492), 3).map((t) => t.label);
		expect(near).toContain('Mirtul');
		expect(near).not.toContain('Midwinter');
		expect(near).toContain('1492 DR');
	});

	it('le tacche non si accavallano', () => {
		const l = layoutLine(items([day(1491), day(1491, 4, 1), day(1491, 9, 29)]), 4);
		const ticks = ticksFor(l, worldTicks(harptos));
		for (let i = 1; i < ticks.length; i++) expect(ticks[i].x - ticks[i - 1].x).toBeGreaterThanOrEqual(56);
	});

	it('le date reali sono giorni dal 1970, con i mesi e i lunedì come tacche', () => {
		expect(isoOfDay(realDay('2026-10-24'))).toBe('2026-10-24');
		expect(realDay('1970-01-02')).toBe(1);
		const labels = realTicks('it')(realDay('2026-09-20'), realDay('2026-10-20'), 10).map((t) => t.label);
		expect(labels).toContain('ott 2026');
		expect(labels).toContain('21 set');
	});
});
