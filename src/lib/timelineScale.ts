import { dayNumber, formatDate, type Calendar } from './calendar.ts';
import type { WorldDate } from './content/types.ts';

/*
 * La linea del tempo in scala: dove mettere ogni evento, su quale corsia, e le tacche dell'asse.
 * Le posizioni (`t`) sono giorni: per l'asse del mondo il numero del giorno nel calendario (`dayNumber`,
 * la stessa `sortKey` del database), per la data di gioco i giorni dal 1° gennaio 1970.
 * `ppu` sono i pixel per giorno: lo zoom.
 */

export interface LineGeom {
	/** Larghezza e altezza di una scheda. */
	cardW: number;
	cardH: number;
	/** Spazio verticale tra due corsie. */
	gap: number;
	/** Quante corsie, una sopra l'altra, prima di spostare in avanti le schede. */
	lanes: number;
	/** Spazio minimo tra due schede sulla stessa corsia. */
	sep: number;
	/**
	 * Oltre questa distanza in pixel un salto si accorcia, e lo si dice («≈ 318 anni»); con la striscia larga,
	 * oltre `maxGapShare` della larghezza visibile: così un solo salto non si prende tutto lo schermo.
	 */
	maxGap: number;
	maxGapShare: number;
	/** Margine prima del primo evento e dopo l'ultimo. */
	padL: number;
	tail: number;
	/** Fascia in alto per l'etichetta di «oggi». */
	strip: number;
	/** Gambo tra la corsia più bassa e l'asse. */
	stem: number;
	/** Il segno dell'evento sta a questa distanza dal bordo sinistro della sua scheda. */
	pin: number;
}

export const GEOM: LineGeom = { cardW: 216, cardH: 96, gap: 10, lanes: 3, sep: 12, maxGap: 220, maxGapShare: 0.6, padL: 24, tail: 170, strip: 34, stem: 20, pin: 16 };

export interface LineItem {
	id: number;
	t: number;
}

export interface Placed {
	id: number;
	t: number;
	/** Posizione del segno sull'asse. */
	x: number;
	lane: number;
	/** Bordo alto e basso della scheda. */
	top: number;
	bottom: number;
}

/** Un salto accorciato: dove metterne l'etichetta e quanti giorni copre. */
export interface Gap {
	x: number;
	days: number;
}

export interface Tick {
	t: number;
	x: number;
	label: string;
	major: boolean;
}

/** Le tacche tra due posizioni, con `k` pixel per giorno. */
export type TickGen = (ta: number, tb: number, k: number) => Omit<Tick, 'x'>[];

interface Seg {
	ta: number;
	tb: number;
	xa: number;
	xb: number;
	broken: boolean;
}

export interface LineLayout {
	cards: Placed[];
	gaps: Gap[];
	segs: Seg[];
	/** Larghezza della striscia (almeno quella visibile) e quella che servirebbe davvero. */
	width: number;
	natural: number;
	height: number;
	axisY: number;
	ppu: number;
	xOf: (t: number) => number;
	tOf: (x: number) => number;
}

type Point = { t: number; x: number };

/** Interpolazione lineare a tratti tra punti ordinati per `from`. */
export function interp(points: Point[], from: 't' | 'x', to: 't' | 'x', v: number): number {
	if (!points.length) return 0;
	if (v <= points[0][from]) return points[0][to];
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		if (v <= b[from]) {
			const span = b[from] - a[from];
			return span ? a[to] + ((v - a[from]) / span) * (b[to] - a[to]) : a[to];
		}
	}
	return points[points.length - 1][to];
}

/**
 * Dispone gli eventi (già in ordine) sulla striscia. In scala finché il salto dal precedente sta sotto `maxGap`;
 * oltre si accorcia. Ogni scheda va sulla prima corsia libera; se sono tutte occupate, la scheda e quelle dopo
 * slittano in avanti quanto basta, così l'ordine resta giusto e niente si sovrappone.
 */
export function layoutLine(items: LineItem[], ppu: number, visible = 0, g: LineGeom = GEOM): LineLayout {
	const maxGap = Math.max(g.maxGap, visible * g.maxGapShare);
	const cards: Placed[] = [];
	const segs: Seg[] = [];
	const right: number[] = [];
	let prev: Placed | null = null;
	for (const it of items) {
		let x = g.padL + g.pin;
		let broken = false;
		if (prev) {
			let d = (it.t - prev.t) * ppu;
			if (d > maxGap) {
				d = maxGap;
				broken = true;
			}
			x = prev.x + d;
		}
		let left = x - g.pin;
		let lane = right.findIndex((r) => r + g.sep <= left);
		if (lane < 0) {
			if (right.length < g.lanes) lane = right.length;
			else {
				const min = Math.min(...right);
				lane = right.indexOf(min);
				x += min + g.sep - left;
				left = x - g.pin;
			}
		}
		right[lane] = left + g.cardW;
		const placed: Placed = { id: it.id, t: it.t, x, lane, top: 0, bottom: 0 };
		if (prev) segs.push({ ta: prev.t, tb: it.t, xa: prev.x, xb: x, broken });
		cards.push(placed);
		prev = placed;
	}
	const lastX = prev?.x ?? g.padL + g.pin;
	const natural = Math.max(...right, lastX + g.tail, 0) + g.padL;
	const width = Math.max(natural, visible);
	const lanes = Math.max(1, right.length);
	const axisY = g.strip + lanes * (g.cardH + g.gap) + g.stem;
	for (const c of cards) {
		c.bottom = axisY - g.stem - c.lane * (g.cardH + g.gap);
		c.top = c.bottom - g.cardH;
	}
	const first = cards[0]?.t ?? 0;
	const last = prev?.t ?? 0;
	const points: Point[] = [{ t: first - (g.padL + g.pin) / ppu, x: 0 }, ...cards.map((c) => ({ t: c.t, x: c.x })), { t: last + (width - lastX) / ppu, x: width }];
	const gaps = segs.filter((s) => s.broken).map((s) => ({ x: (s.xa + s.xb) / 2, days: s.tb - s.ta }));
	return {
		cards,
		gaps,
		segs,
		width,
		natural,
		height: axisY + 40,
		axisY,
		ppu,
		xOf: (t) => interp(points, 't', 'x', t),
		tOf: (x) => interp(points, 'x', 't', x)
	};
}

/**
 * Lo zoom più forte con cui tutta la striscia sta in `visible` pixel. Se le schede non ci stanno comunque, una
 * accanto all'altra, la striscia può allungarsi del 15% oltre il minimo: così resta in scala, invece di avere
 * le posizioni decise solo dalle corsie.
 */
export function fitPpu(items: LineItem[], visible: number, min: number, max: number, g: LineGeom = GEOM): number {
	const natural = (ppu: number) => layoutLine(items, ppu, visible, g).natural;
	const floor = natural(min);
	const room = floor > visible ? floor * 1.15 : visible;
	if (natural(max) <= room) return max;
	let lo = min;
	let hi = max;
	for (let i = 0; i < 40; i++) {
		const mid = Math.sqrt(lo * hi);
		if (natural(mid) <= room) lo = mid;
		else hi = mid;
	}
	return lo;
}

/** Le tacche dei tratti in scala (non in quelli accorciati), senza etichette accavallate. */
export function ticksFor(l: LineLayout, gen: TickGen, minDist = 56): Tick[] {
	const all: Tick[] = [];
	for (const s of l.segs) {
		if (s.broken || s.tb <= s.ta) continue;
		const k = (s.xb - s.xa) / (s.tb - s.ta);
		for (const tk of gen(s.ta, s.tb, k)) all.push({ ...tk, x: s.xa + (tk.t - s.ta) * k });
	}
	all.sort((a, b) => a.x - b.x);
	const kept: Tick[] = [];
	for (const tk of all) {
		const last = kept.at(-1);
		if (!last || tk.x - last.x >= minDist) kept.push(tk);
		else if (tk.major && !last.major) kept[kept.length - 1] = tk;
	}
	return kept;
}

// --- Calendario del mondo ---

export const yearLength = (cal: Calendar) => cal.months.reduce((s, m) => s + m.days, 0);

/** Durata media di un anno, bisestili compresi: per dire quanti anni copre un salto. */
export const averageYear = (cal: Calendar) => (dayNumber(cal, { year: 4000 }) - dayNumber(cal, { year: 0 })) / 4000 || 1;

/** Durata media di un mese normale (le feste fuori dai mesi non contano). */
export function monthLength(cal: Calendar): number {
	const regular = cal.months.filter((m) => !m.festival);
	return regular.length ? regular.reduce((s, m) => s + m.days, 0) / regular.length : yearLength(cal);
}

/** L'anno che contiene il giorno `n`. */
export function yearOfDay(cal: Calendar, n: number): number {
	const len = yearLength(cal) || 1;
	let y = Math.floor(n / len);
	while (dayNumber(cal, { year: y + 1 }) <= n) y++;
	while (dayNumber(cal, { year: y }) > n) y--;
	return y;
}

/** Il contrario di `dayNumber`: la data del giorno `n`. */
export function dateOfDay(cal: Calendar, n: number): WorldDate {
	const year = yearOfDay(cal, Math.floor(n));
	let month = 1;
	while (month < cal.months.length && dayNumber(cal, { year, month: month + 1, day: 1 }) <= n) month++;
	const day = Math.floor(n) - dayNumber(cal, { year, month, day: 1 }) + 1;
	return { year, month, day };
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10_000, 20_000, 50_000, 100_000];

/** Tacche dell'asse del mondo: i mesi quando c'è spazio, altrimenti gli anni a passi tondi. */
export function worldTicks(cal: Calendar): TickGen {
	const len = yearLength(cal);
	const month = monthLength(cal);
	return (ta, tb, k) => {
		const out: Omit<Tick, 'x'>[] = [];
		const y0 = yearOfDay(cal, ta);
		const y1 = yearOfDay(cal, tb);
		const push = (t: number, label: string, major: boolean) => {
			if (t > ta && t <= tb) out.push({ t, label, major });
		};
		if (k * month >= 46 && y1 - y0 < 200) {
			for (let y = y0; y <= y1; y++) {
				push(dayNumber(cal, { year: y }), formatDate(cal, { year: y }), true);
				cal.months.forEach((m, i) => {
					if (i > 0 && !m.festival) push(dayNumber(cal, { year: y, month: i + 1, day: 1 }), m.name, false);
				});
			}
			return out;
		}
		const step = STEPS.find((s) => s * len * k >= 70) ?? STEPS[STEPS.length - 1];
		for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) push(dayNumber(cal, { year: y }), String(y), y % (step * 5) === 0);
		return out;
	};
}

// --- Date reali (data di gioco) ---

const DAY = 86_400_000;
export const realDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY;
export const isoOfDay = (n: number) => new Date(Math.round(n) * DAY).toISOString().slice(0, 10);

/** Tacche della data di gioco: inizio dei mesi, e i lunedì quando c'è spazio; da lontano gli anni. */
export function realTicks(locale: string): TickGen {
	const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...o });
	const monthYear = fmt({ month: 'short', year: 'numeric' });
	const dayMonth = fmt({ day: 'numeric', month: 'short' });
	return (ta, tb, k) => {
		const out: Omit<Tick, 'x'>[] = [];
		if (k * 30 < 46) {
			const y0 = new Date(ta * DAY).getUTCFullYear();
			const y1 = new Date(tb * DAY).getUTCFullYear();
			for (let y = y0; y <= y1; y++) {
				const t = Date.UTC(y, 0, 1) / DAY;
				if (t > ta && t <= tb) out.push({ t, label: String(y), major: true });
			}
			return out;
		}
		for (let d = Math.floor(ta) + 1; d <= tb; d++) {
			const date = new Date(d * DAY);
			if (date.getUTCDate() === 1) out.push({ t: d, label: monthYear.format(date), major: true });
			else if (k * 7 >= 64 && date.getUTCDay() === 1) out.push({ t: d, label: dayMonth.format(date), major: false });
		}
		return out;
	};
}
