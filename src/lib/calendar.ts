import type { WorldDate } from './content/types.ts';

/** Calendario del mondo di gioco. Mesi e giorni nelle date partono da 1. */
export interface CalMonth {
	name: string;
	days: number;
	/** Giorno di festa fuori dai mesi (es. Mezzinverno): si scrive senza numero del giorno. */
	festival?: boolean;
}

export interface CalEra {
	name: string;
	abbr: string;
	/** Primo anno dell'era. */
	start: number;
}

/** Anno bisestile: ogni `every` anni (con resto `offset`) il mese `month` (da 1) ha `days` giorni in più. */
export interface CalLeap {
	every: number;
	offset: number;
	month: number;
	days: number;
	/** Eccezioni come nel calendario gregoriano: niente bisestile ogni `skip` anni, salvo ogni `keep` anni. */
	skip?: number | null;
	keep?: number | null;
}

export interface Calendar {
	name: string;
	months: CalMonth[];
	weekdays: string[];
	eras: CalEra[];
	leap: CalLeap | null;
	/** "Oggi" nel mondo di gioco, per scrivere "120 anni fa". */
	today: WorldDate | null;
}

const floorDiv = (a: number, b: number) => Math.floor(a / b);

/** Quanti anni y < n hanno y ≡ r (mod m), contati a partire da 0 (negativi per n < 0). */
function prefix(n: number, m: number, r = 0): number {
	return floorDiv(n - r - 1, m) + 1;
}

function leapsBefore(cal: Calendar, year: number): number {
	const l = cal.leap;
	if (!l || l.every < 1) return 0;
	let n = prefix(year, l.every, l.offset);
	if (l.skip) n -= prefix(year, l.skip, l.offset);
	if (l.skip && l.keep) n += prefix(year, l.keep, l.offset);
	return n;
}

export function isLeap(cal: Calendar, year: number): boolean {
	return leapsBefore(cal, year + 1) - leapsBefore(cal, year) > 0;
}

export function monthDays(cal: Calendar, year: number, month: number): number {
	const m = cal.months[month - 1];
	if (!m) return 0;
	return m.days + (cal.leap && cal.leap.month === month && isLeap(cal, year) ? cal.leap.days : 0);
}

const baseYear = (cal: Calendar) => cal.months.reduce((s, m) => s + m.days, 0);

export function yearDays(cal: Calendar, year: number): number {
	return baseYear(cal) + (cal.leap && isLeap(cal, year) ? cal.leap.days : 0);
}

/** Numero assoluto del giorno (0 = primo giorno dell'anno 0): serve per ordinare e confrontare le date. */
export function dayNumber(cal: Calendar, d: WorldDate): number {
	let n = d.year * baseYear(cal) + leapsBefore(cal, d.year) * (cal.leap?.days ?? 0);
	const month = d.month ?? 1;
	for (let m = 1; m < month; m++) n += monthDays(cal, d.year, m);
	return n + (d.day ?? 1) - 1;
}

export function eraOf(cal: Calendar, year: number): CalEra | null {
	let best: CalEra | null = null;
	for (const e of cal.eras) if (e.start <= year && (!best || e.start > best.start)) best = e;
	return best;
}

/** Controlla che una data esista nel calendario. */
export function validDate(cal: Calendar, d: WorldDate): boolean {
	if (!Number.isInteger(d.year) || Math.abs(d.year) > 1_000_000) return false;
	if (d.month == null) return d.day == null;
	if (!Number.isInteger(d.month) || d.month < 1 || d.month > cal.months.length) return false;
	if (d.day == null) return true;
	return Number.isInteger(d.day) && d.day >= 1 && d.day <= monthDays(cal, d.year, d.month);
}

/** "15 Mirtul 1491 DR", "Mezzinverno 1491 DR", "1491 DR". */
export function formatDate(cal: Calendar, d: WorldDate): string {
	const era = eraOf(cal, d.year);
	const year = `${d.year}${era ? ' ' + era.abbr : ''}`;
	const m = d.month ? cal.months[d.month - 1] : undefined;
	if (!m) return year;
	if (m.festival || !d.day) return `${m.name} ${year}`;
	return `${d.day} ${m.name} ${year}`;
}

export function weekday(cal: Calendar, d: WorldDate): string | null {
	if (!cal.weekdays.length || !d.month || !d.day || cal.months[d.month - 1]?.festival) return null;
	const n = cal.weekdays.length;
	return cal.weekdays[((dayNumber(cal, d) % n) + n) % n];
}

/** Anni trascorsi da una data a "oggi" nel mondo (negativo = nel futuro). */
export function yearsAgo(cal: Calendar, d: WorldDate): number | null {
	if (!cal.today) return null;
	return cal.today.year - d.year;
}

// --- Calendari pronti ---

export const PRESETS = ['gregorian', 'harptos', 'simple'] as const;
export type Preset = (typeof PRESETS)[number];

const GREG: Record<string, string[]> = {
	it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
	en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};
const GREG_DAYS: Record<string, string[]> = {
	it: ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],
	en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
};

export function preset(id: Preset, locale: string): Calendar {
	const it = locale === 'it';
	if (id === 'gregorian') {
		const len = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		return {
			name: it ? 'Gregoriano' : 'Gregorian',
			months: (GREG[locale] ?? GREG.en).map((name, i) => ({ name, days: len[i] })),
			// L'anno 0 cade di sabato con questa convenzione: si sposta l'inizio della settimana.
			weekdays: rotate(GREG_DAYS[locale] ?? GREG_DAYS.en, 5),
			eras: [{ name: it ? 'Dopo Cristo' : 'Anno Domini', abbr: it ? 'd.C.' : 'AD', start: 1 }],
			leap: { every: 4, offset: 0, month: 2, days: 1, skip: 100, keep: 400 },
			today: null
		};
	}
	if (id === 'harptos') {
		const f = (name: string) => ({ name, days: 1, festival: true });
		const m = (name: string) => ({ name, days: 30 });
		return {
			name: 'Harptos',
			months: [
				m('Hammer'),
				f('Midwinter'),
				m('Alturiak'),
				m('Ches'),
				m('Tarsakh'),
				f('Greengrass'),
				m('Mirtul'),
				m('Kythorn'),
				m('Flamerule'),
				f('Midsummer'),
				m('Eleasis'),
				m('Eleint'),
				f('Highharvestide'),
				m('Marpenoth'),
				m('Uktar'),
				f('Feast of the Moon'),
				m('Nightal')
			],
			weekdays: Array.from({ length: 10 }, (_, i) => (it ? `${i + 1}° giorno` : `Day ${i + 1}`)),
			eras: [{ name: 'Dalereckoning', abbr: 'DR', start: 1 }],
			// Shieldmeet: un giorno in più dopo Midsummer ogni 4 anni.
			leap: { every: 4, offset: 0, month: 10, days: 1, skip: null, keep: null },
			today: { year: 1491, month: 1, day: 1 }
		};
	}
	return {
		name: it ? 'Semplice' : 'Simple',
		months: Array.from({ length: 12 }, (_, i) => ({ name: it ? `Mese ${i + 1}` : `Month ${i + 1}`, days: 30 })),
		weekdays: Array.from({ length: 7 }, (_, i) => (it ? `Giorno ${i + 1}` : `Day ${i + 1}`)),
		eras: [],
		leap: null,
		today: null
	};
}

function rotate<T>(a: T[], n: number): T[] {
	return [...a.slice(n), ...a.slice(0, n)];
}

// --- Scrittura come testo (per l'editor del calendario) ---

export interface CalendarText {
	name: string;
	months: string;
	weekdays: string;
	eras: string;
	leapEvery: string;
	leapOffset: string;
	leapMonth: string;
	leapDays: string;
	leapSkip: string;
	leapKeep: string;
	todayYear: string;
	todayMonth: string;
	todayDay: string;
}

export function toText(cal: Calendar): CalendarText {
	return {
		name: cal.name,
		months: cal.months.map((m) => `${m.name}: ${m.days}${m.festival ? ' *' : ''}`).join('\n'),
		weekdays: cal.weekdays.join('\n'),
		eras: cal.eras.map((e) => `${e.name} | ${e.abbr} | ${e.start}`).join('\n'),
		leapEvery: String(cal.leap?.every ?? ''),
		leapOffset: String(cal.leap?.offset ?? ''),
		leapMonth: String(cal.leap?.month ?? ''),
		leapDays: String(cal.leap?.days ?? ''),
		leapSkip: String(cal.leap?.skip ?? ''),
		leapKeep: String(cal.leap?.keep ?? ''),
		todayYear: String(cal.today?.year ?? ''),
		todayMonth: String(cal.today?.month ?? ''),
		todayDay: String(cal.today?.day ?? '')
	};
}

const int = (s: string) => (s.trim() === '' ? null : /^-?\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** Legge il calendario scritto come testo; restituisce la chiave di traduzione dell'errore. */
export function fromText(t: CalendarText): { ok: true; cal: Calendar } | { ok: false; error: string; line?: number } {
	const lines = (s: string) =>
		s
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);

	const months: CalMonth[] = [];
	for (const [i, l] of lines(t.months).entries()) {
		const m = /^(.+?)\s*:\s*(\d{1,3})\s*(\*)?$/.exec(l);
		if (!m || Number(m[2]) < 1) return { ok: false, error: 'calendar.errMonth', line: i + 1 };
		months.push({ name: m[1].slice(0, 60), days: Number(m[2]), ...(m[3] ? { festival: true } : {}) });
	}
	if (!months.length || months.length > 60) return { ok: false, error: 'calendar.errMonths' };

	const weekdays = lines(t.weekdays.replace(/,/g, '\n')).map((w) => w.slice(0, 40));
	if (weekdays.length > 30) return { ok: false, error: 'calendar.errWeekdays' };

	const eras: CalEra[] = [];
	for (const [i, l] of lines(t.eras).entries()) {
		const p = l.split('|').map((x) => x.trim());
		const start = int(p[2] ?? '');
		if (p.length !== 3 || !p[0] || start === null || Number.isNaN(start))
			return { ok: false, error: 'calendar.errEra', line: i + 1 };
		eras.push({ name: p[0].slice(0, 60), abbr: p[1].slice(0, 12), start });
	}

	let leap: CalLeap | null = null;
	const every = int(t.leapEvery);
	if (every !== null) {
		const month = int(t.leapMonth);
		const days = int(t.leapDays);
		const offset = int(t.leapOffset) ?? 0;
		const skip = int(t.leapSkip);
		const keep = int(t.leapKeep);
		if (
			Number.isNaN(every) || every < 1 ||
			month === null || Number.isNaN(month) || month < 1 || month > months.length ||
			days === null || Number.isNaN(days) || days < 1 || days > 31 ||
			Number.isNaN(offset) || offset < 0 || offset >= every ||
			Number.isNaN(skip) || Number.isNaN(keep)
		)
			return { ok: false, error: 'calendar.errLeap' };
		leap = { every, offset, month, days, skip: skip || null, keep: keep || null };
	}

	const cal: Calendar = { name: t.name.trim().slice(0, 60) || 'Calendar', months, weekdays, eras, leap, today: null };
	const ty = int(t.todayYear);
	if (ty !== null) {
		const today = { year: ty, month: int(t.todayMonth), day: int(t.todayDay) };
		if (!validDate(cal, today as WorldDate)) return { ok: false, error: 'calendar.errToday' };
		cal.today = today as WorldDate;
	}
	return { ok: true, cal };
}

export function isCalendar(v: unknown): v is Calendar {
	const c = v as Calendar;
	return !!c && Array.isArray(c.months) && c.months.length > 0 && Array.isArray(c.weekdays) && Array.isArray(c.eras);
}
