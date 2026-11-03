/**
 * Appuntamenti: date e orari "di parete" (`2026-11-05`, `20:00`), senza fusi orari: il tavolo è uno.
 * Le ripetizioni non diventano righe: le date di una serie si calcolano per il mese che si guarda.
 */
export const REPEATS = ['none', 'week', '2weeks', 'month'] as const;
export type Repeat = (typeof REPEATS)[number];

export const ANSWERS = ['in_person', 'remote', 'no'] as const;
export type Answer = (typeof ANSWERS)[number];

export interface Series {
	date: string;
	repeat: Repeat;
	until: string | null;
	/** Le date annullate dal Master. */
	skips: string[];
}

const DAY = 86_400_000;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MONTH_RE = /^\d{4}-\d{2}$/;

const toDay = (d: string) => Date.parse(d + 'T00:00:00Z') / DAY;
const fromDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
/** 0 = lunedì. */
const weekday = (n: number) => (new Date(n * DAY).getUTCDay() + 6) % 7;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Le date della serie da `from` a `to` compresi. "Ogni mese" è lo stesso giorno della settimana nella stessa posizione (es. il primo giovedì): i mesi senza un quinto giovedì si saltano. */
export function occurrences(s: Series, from: string, to: string): string[] {
	const start = toDay(s.date);
	const last = Math.min(toDay(to), s.repeat === 'none' ? start : s.until ? toDay(s.until) : Infinity);
	const first = Math.max(start, toDay(from));
	const out: number[] = [];
	if (s.repeat === 'month') {
		const nth = Math.ceil(Number(s.date.slice(8)) / 7);
		const wd = weekday(start);
		let [y, m] = fromDay(first).split('-').map(Number);
		while (Date.UTC(y, m - 1, 1) / DAY <= last) {
			const d1 = Date.UTC(y, m - 1, 1) / DAY;
			const d = 1 + ((wd - weekday(d1) + 7) % 7) + (nth - 1) * 7;
			if (d <= daysIn(y, m)) out.push(d1 + d - 1);
			[y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
		}
	} else {
		const step = s.repeat === '2weeks' ? 14 : 7;
		for (let d = start + Math.ceil((first - start) / step) * step; d <= last; d += step) out.push(d);
	}
	return out.filter((d) => d >= first && d <= last).map(fromDay).filter((d) => !s.skips.includes(d));
}

/** Le settimane del mese `YYYY-MM`, dal lunedì: null per i giorni degli altri mesi. */
export function monthGrid(month: string): (string | null)[][] {
	const [y, m] = month.split('-').map(Number);
	const d1 = Date.UTC(y, m - 1, 1) / DAY;
	const cells: (string | null)[] = [...Array(weekday(d1)).fill(null), ...Array.from({ length: daysIn(y, m) }, (_, i) => fromDay(d1 + i))];
	while (cells.length % 7) cells.push(null);
	return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function shiftMonth(month: string, by: number): string {
	const [y, m] = month.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Oggi, nell'ora del server (TZ). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** La data `n` giorni dopo (o prima, con `n` negativo). */
export const shiftDay = (d: string, n: number) => fromDay(toDay(d) + n);

export const lastOfMonth = (month: string) => `${month}-${daysIn(Number(month.slice(0, 4)), Number(month.slice(5)))}`;

export type Status = 'confirmed' | 'pending' | 'cancelled';

/**
 * La regola della campagna: con almeno `min` giocatori la sessione è confermata; sotto, è in forse finché mancano
 * più di `hours` ore all'inizio, poi salta. Senza regola (`min` 0) nessuno stato. `now` nell'ora del server (TZ).
 */
export function sessionStatus(date: string, starts: string, going: number, rule: { min: number; hours: number }, now = Date.now()): Status | null {
	if (rule.min <= 0) return null;
	if (going >= rule.min) return 'confirmed';
	const [y, m, d] = date.split('-').map(Number);
	const [h, mm] = starts.split(':').map(Number);
	return new Date(y, m - 1, d, h, mm).getTime() - rule.hours * 3_600_000 > now ? 'pending' : 'cancelled';
}

/** Quando finisce una data, nell'ora del server (TZ): una fine prima dell'inizio (o uguale) è il giorno dopo. */
export function endsAt(date: string, starts: string, ends: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const [h, mm] = ends.split(':').map(Number);
	return new Date(y, m - 1, d + (ends <= starts ? 1 : 0), h, mm).getTime();
}

/**
 * Stars & Wishes: l'ultima sessione finita, finché non arriva il giorno di quella dopo (o per sempre, se non ce n'è una).
 * Le sessioni saltate per la regola del minimo non contano. `items` in ordine, come li dà il calendario.
 */
export function starWishSession<T extends { date: string; starts: string; ends: string; status: Status | null }>(items: T[], now = Date.now()): T | null {
	const held = items.filter((o) => o.status !== 'cancelled');
	const i = held.findLastIndex((o) => endsAt(o.date, o.starts, o.ends) <= now);
	if (i < 0) return null;
	const next = held[i + 1];
	return !next || localDate(new Date(now)) < next.date ? held[i] : null;
}

/** Solo indirizzi web: un link `javascript:` scritto nel modulo non deve finire in un href. */
export function webLink(s: string): string | null {
	try {
		const u = new URL(s);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
	} catch {
		return null;
	}
}
