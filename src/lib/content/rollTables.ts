import type { DocNode } from './types.ts';
import { blockId, blockVisibility, liftBlocks } from './blocks.ts';
import { slugify } from '../slug.ts';

/**
 * Tabelle di tiro: una tabella dell'editor con `attrs.roll`, che sta nel primo livello della pagina (ha l'id del blocco).
 * - Prima riga: nella prima cella il dado (d4, d6, d8, d10, d12, d20, d100 o d%, d66, oppure più dadi sommati: 2d6, 3d6…),
 *   nella seconda il nome della tabella.
 * - Le altre righe: nella prima cella i numeri del dado (4, 2-3, 01–05; 0 nel d10 e 00 nel d100 valgono 10 e 100),
 *   nelle altre il risultato. Senza nessun numero nella prima colonna, ogni riga ha la stessa probabilità.
 * Il tiro lo fa il server (vedi server/rollTables.ts), sulla pagina come la vede chi tira: una tabella oscurata la tira
 * solo il Master.
 */

/** Il dado di una tabella: `count` dadi da `sides` facce sommati, oppure il d66 (decine e unità da due d6). */
export type Die = { count: number; sides: number } | 'd66';

export const MAX_DICE = 20;
export const MAX_SIDES = 1000;

export function parseDie(text: string): Die | null {
	const s = text.replace(/\s+/g, '').toLowerCase();
	if (s === 'd66') return 'd66';
	if (s === 'd%') return { count: 1, sides: 100 };
	const m = /^(\d{0,2})d(\d{1,4})$/.exec(s);
	if (!m) return null;
	const count = m[1] ? Number(m[1]) : 1;
	const sides = Number(m[2]);
	if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) return null;
	return { count, sides };
}

export const dieLabel = (d: Die) => (d === 'd66' ? 'd66' : `${d.count > 1 ? d.count : ''}d${d.sides}`);

/** I risultati possibili del dado, dal più basso al più alto. */
export function outcomes(d: Die): number[] {
	const six = [1, 2, 3, 4, 5, 6];
	if (d === 'd66') return six.flatMap((t) => six.map((u) => t * 10 + u));
	return Array.from({ length: d.count * (d.sides - 1) + 1 }, (_, i) => d.count + i);
}

/** Un numero a caso da 0 a n-1. Scarta i valori in eccesso: col solo resto della divisione alcune facce uscirebbero più spesso. */
export function randomBelow(n: number): number {
	const limit = Math.floor(0x1_0000_0000 / n) * n;
	const buf = new Uint32Array(1);
	do crypto.getRandomValues(buf);
	while (buf[0] >= limit);
	return buf[0] % n;
}

/** Da 0 a n-1 (nei test si passa un generatore che si conosce). */
export type Random = (n: number) => number;

export function rollDie(d: Die, random: Random = randomBelow): { value: number; dice: number[] } {
	if (d === 'd66') {
		const dice = [random(6) + 1, random(6) + 1];
		return { value: dice[0] * 10 + dice[1], dice };
	}
	const dice = Array.from({ length: d.count }, () => random(d.sides) + 1);
	return { value: dice.reduce((a, b) => a + b, 0), dice };
}

/** I numeri di una riga: «4», «2-3», «01–05». Con un solo d10 o d100, «0» e «00» valgono 10 e 100. null = non si capisce. */
export function parseRange(text: string, d: Die): [number, number] | null {
	const m = /^(\d{1,5})(?:[-–—](\d{1,5}))?$/.exec(text.replace(/\s+/g, ''));
	if (!m) return null;
	const top = d !== 'd66' && d.count === 1 && (d.sides === 10 || d.sides === 100) ? d.sides : null;
	const num = (x: string) => (top && /^0+$/.test(x) ? top : Number(x));
	const a = num(m[1]);
	const b = m[2] === undefined ? a : num(m[2]);
	return a <= b ? [a, b] : [b, a];
}

export interface RollRow {
	from: number;
	to: number;
	/** Le celle del risultato (dalla seconda in poi). */
	cells: DocNode[];
}

export interface RollTable {
	name: string;
	die: Die;
	rows: RollRow[];
}

/** Cosa non va in una tabella di tiro. `row` conta dalla prima riga dopo l'intestazione, da 1. */
export type RollProblem =
	| { code: 'columns' | 'name' | 'rows' | 'die' }
	| { code: 'range' | 'outside'; row: number }
	| { code: 'gap' | 'overlap'; value: number };

export const isRollTable = (n: DocNode) => n.type === 'table' && n.attrs?.roll === true;

const TEXTBLOCKS = new Set(['paragraph', 'heading', 'codeBlock']);

/** Il testo di un nodo: i collegamenti valgono il testo che mostrano, i paragrafi sono separati da uno spazio. */
export function nodeText(n: DocNode): string {
	switch (n.type) {
		case 'text':
			return n.text ?? '';
		case 'wikiLink':
			return String(n.attrs?.label || n.attrs?.title || n.attrs?.target || '');
		case 'ruleRef':
			return String(n.attrs?.label || n.attrs?.name || '');
		case 'hardBreak':
			return ' ';
	}
	return (n.content ?? []).map(nodeText).join(TEXTBLOCKS.has(n.type) ? '' : ' ');
}

const cellText = (n: DocNode | undefined) => (n ? nodeText(n).replace(/\s+/g, ' ').trim() : '');

const rowsOf = (t: DocNode) => (t.content ?? []).filter((r) => r.type === 'tableRow').map((r) => r.content ?? []);

/** Il nome della tabella: la seconda cella della prima riga. */
export const tableName = (t: DocNode) => cellText(rowsOf(t)[0]?.[1]);

/** La prima posizione di `list` (in ordine) con un valore ≥ v. */
function lowerBound(list: number[], v: number): number {
	let lo = 0;
	let hi = list.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (list[mid] < v) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

export type ReadResult = { ok: true; table: RollTable } | { ok: false; name: string; problem: RollProblem };

/** Legge una tabella di tiro e controlla che ogni risultato del dado stia in una riga, e in una sola. */
export function readRollTable(t: DocNode): ReadResult {
	const rows = rowsOf(t);
	const head = rows[0] ?? [];
	const name = cellText(head[1]);
	const fail = (problem: RollProblem): ReadResult => ({ ok: false, name, problem });
	if (head.length < 2) return fail({ code: 'columns' });
	if (!name) return fail({ code: 'name' });
	const body = rows.slice(1).filter((r) => r.length);
	if (!body.length) return fail({ code: 'rows' });
	const ranges = body.map((r) => cellText(r[0]));

	// Senza numeri: una riga vale l'altra.
	if (ranges.every((r) => !r))
		return { ok: true, table: { name, die: { count: 1, sides: body.length }, rows: body.map((r, i) => ({ from: i + 1, to: i + 1, cells: r.slice(1) })) } };

	const die = parseDie(cellText(head[0]));
	if (!die) return fail({ code: 'die' });
	const all = outcomes(die);
	const parsed: RollRow[] = [];
	for (const [i, r] of body.entries()) {
		const range = parseRange(ranges[i], die);
		if (!range) return fail({ code: 'range', row: i + 1 });
		if (range[0] < all[0] || range[1] > all[all.length - 1]) return fail({ code: 'outside', row: i + 1 });
		parsed.push({ from: range[0], to: range[1], cells: r.slice(1) });
	}
	// Ogni risultato possibile ha una riga sola (nel d66 tra 16 e 21 non ce ne sono: «11-21» va bene).
	const owner = new Map<number, number>();
	for (const [i, r] of parsed.entries())
		for (let k = lowerBound(all, r.from); k < all.length && all[k] <= r.to; k++) {
			if (owner.has(all[k])) return fail({ code: 'overlap', value: all[k] });
			owner.set(all[k], i);
		}
	const gap = all.find((v) => !owner.has(v));
	if (gap !== undefined) return fail({ code: 'gap', value: gap });
	return { ok: true, table: { name, die, rows: parsed } };
}

/** Il contenuto di una cella come testo in linea (con grassetti, collegamenti e regole); le immagini restano fuori. */
function cellInline(cell: DocNode): DocNode[] {
	const out: DocNode[] = [];
	const walk = (n: DocNode) => {
		if (n.type === 'text') {
			if (n.text) out.push(n);
		} else if (n.type === 'wikiLink' || n.type === 'ruleRef') out.push(n);
		else if (n.type === 'hardBreak') out.push({ type: 'text', text: ' ' });
		else if (n.content) {
			if (TEXTBLOCKS.has(n.type) && out.length) out.push({ type: 'text', text: ' ' });
			n.content.forEach(walk);
		}
	};
	walk(cell);
	return out;
}

/** Il risultato di una riga, da mettere nel testo: le celle dopo la prima, separate da « — ». */
export function rowInline(row: RollRow): DocNode[] {
	return row.cells
		.map(cellInline)
		.filter((c) => c.length)
		.flatMap((c, i) => (i ? [{ type: 'text', text: ' — ' }, ...c] : c));
}

export interface RollOutcome {
	/** Il numero uscito (la somma, o le due cifre del d66). */
	value: number;
	dice: number[];
	die: string;
	/** La riga uscita, da 1. */
	row: number;
	content: DocNode[];
}

export function rollTable(t: RollTable, random: Random = randomBelow): RollOutcome {
	const { value, dice } = rollDie(t.die, random);
	const i = t.rows.findIndex((r) => r.from <= value && value <= r.to);
	return { value, dice, die: dieLabel(t.die), row: i + 1, content: i >= 0 ? rowInline(t.rows[i]) : [] };
}

export interface RollTableRef {
	block: string;
	name: string;
	/** Oscurata: la trova e la tira solo il Master. */
	secret: boolean;
}

/** Le tabelle di tiro di una pagina, per l'indice: solo quelle con un nome, nel primo livello (hanno un id). */
export function rollTablesIn(doc: DocNode): RollTableRef[] {
	return (liftBlocks(doc).content ?? []).flatMap((b) => {
		const id = blockId(b);
		const name = id && isRollTable(b) ? tableName(b) : '';
		return id && name ? [{ block: id, name, secret: blockVisibility(b) !== null }] : [];
	});
}

/** La tabella di tiro con questo id nel primo livello del documento. */
export const findRollTable = (doc: DocNode, block: string) => (doc.content ?? []).find((b) => blockId(b) === block && isRollTable(b));

/** Il testo che spiega un problema: la chiave delle traduzioni e i suoi valori. */
export function problemMessage(p: RollProblem): [string, Record<string, number>] {
	const params: Record<string, number> = 'row' in p ? { row: p.row } : 'value' in p ? { value: p.value } : {};
	return [`rollTables.problem.${p.code}`, params];
}

/** Per cercare una tabella: «/bottega-povera», «/bottegapovera» e «/Bottega povera» trovano «Bottega povera». */
export const nameKey = (s: string) => slugify(s, '').replace(/-/g, '');

/** Una tabella pronta da riempire: il dado, il nome e una riga per faccia. */
export function newRollTable(name: string, sides = 6): DocNode {
	const cell = (type: string, text: string): DocNode => ({ type, content: [text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' }] });
	const row = (...cells: DocNode[]): DocNode => ({ type: 'tableRow', content: cells });
	return {
		type: 'table',
		attrs: { roll: true },
		content: [
			row(cell('tableHeader', `d${sides}`), cell('tableHeader', name)),
			...Array.from({ length: sides }, (_, i) => row(cell('tableCell', String(i + 1)), cell('tableCell', '')))
		]
	};
}
