import data from './srd-5.2.json';
import type { RuleKind } from '../../rules/index.ts';
import { ruleKey } from '../../rules/index.ts';

export interface RuleEntry {
	k: RuleKind;
	i: string;
	n: string;
	/** Riga di riepilogo (livello, tipo, grado di sfida…). */
	s: string;
	/** Testo con **grassetto** e a capo. */
	t: string;
}

const ENTRIES = data as RuleEntry[];
const BY_KEY = new Map<string, RuleEntry>();
for (const e of ENTRIES) {
	BY_KEY.set(`${e.k}/${e.i}`, e);
	BY_KEY.set(`${e.k}/${ruleKey(e.n)}`, e);
}

export const ruleCount = () => ENTRIES.length;

export function getRule(kind: string, key: string): RuleEntry | undefined {
	return BY_KEY.get(`${kind}/${key}`);
}

/** Cerca per nome (prima chi inizia con il testo cercato). */
export function searchRules(q: string, kind?: RuleKind | null, limit = 50): RuleEntry[] {
	const s = q.trim().toLowerCase();
	const pool = kind ? ENTRIES.filter((e) => e.k === kind) : ENTRIES;
	if (!s) return pool.slice(0, limit);
	const starts: RuleEntry[] = [];
	const contains: RuleEntry[] = [];
	for (const e of pool) {
		const n = e.n.toLowerCase();
		if (n.startsWith(s)) starts.push(e);
		else if (n.includes(s)) contains.push(e);
		if (starts.length >= limit) break;
	}
	return [...starts, ...contains].slice(0, limit);
}

const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Testo SRD in HTML sicuro: **grassetto** e paragrafi. */
export function ruleHtml(e: RuleEntry): string {
	return e.t
		.split(/\n+/)
		.filter((l) => l.trim())
		.map((l) => `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`)
		.join('');
}

export const hasRule = (kind: RuleKind, key: string) => BY_KEY.has(`${kind}/${key}`);
