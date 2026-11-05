import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { visibleTo } from './visibility.ts';
import { canSeeBlock, isMaster, type Viewer } from '../access.ts';
import { visibleBlocks } from '../content/blocks.ts';
import { EMPTY_DOC, isDoc, type DocNode } from '../content/types.ts';
import { findRollTable, nameKey, readRollTable, rollTable, rollTablesIn, type Random, type RollOutcome, type RollProblem } from '../content/rollTables.ts';

const { pages, rollTables } = schema;

/** Rifà l'indice delle tabelle di tiro di una pagina: a ogni salvataggio, come i collegamenti. */
export function writeRollTables(pageId: number, doc: DocNode) {
	clearRollTables(pageId);
	const found = rollTablesIn(doc);
	if (found.length)
		getDb()
			.insert(rollTables)
			.values(found.map((t) => ({ pageId, blockId: t.block, name: t.name, secret: t.secret })))
			.run();
}

/** Una pagina nel cestino non ha tabelle da tirare: le riavrà se torna. */
export function clearRollTables(pageId: number) {
	getDb().delete(rollTables).where(eq(rollTables.pageId, pageId)).run();
}

export interface RollTableChoice {
	page: number;
	block: string;
	name: string;
	/** La pagina dove sta: distingue due tabelle con lo stesso nome. */
	pageTitle: string;
}

/**
 * Le tabelle di tiro che chi scrive può tirare, per il «/» dell'editor: nelle pagine che vede, e quelle oscurate solo
 * per il Master. Prima quelle il cui nome comincia con ciò che ha scritto, poi le altre che lo contengono.
 */
export function suggestRollTables(q: string, u: Viewer | null, limit = 8): RollTableChoice[] {
	const secretOk = isMaster(u) ? sql`1=1` : sql`${rollTables.secret} = 0`;
	const rows = getDb()
		.select({ page: rollTables.pageId, block: rollTables.blockId, name: rollTables.name, pageTitle: pages.title })
		.from(rollTables)
		.innerJoin(pages, eq(pages.id, rollTables.pageId))
		.where(and(visibleTo(u), secretOk))
		.all();
	const key = nameKey(q);
	return rows
		.map((r) => ({ r, k: nameKey(r.name) }))
		.filter((x) => x.k.includes(key))
		.sort(
			(a, b) =>
				Number(!a.k.startsWith(key)) - Number(!b.k.startsWith(key)) ||
				a.r.name.localeCompare(b.r.name, undefined, { sensitivity: 'base' }) ||
				a.r.pageTitle.localeCompare(b.r.pageTitle, undefined, { sensitivity: 'base' })
		)
		.slice(0, limit)
		.map((x) => x.r);
}

export type RollResult = { ok: true; name: string; outcome: RollOutcome } | { ok: false; name: string; problem: RollProblem };

/**
 * Tira sulla tabella `block` della pagina `pageId`, come la vede chi tira: se non vede la pagina, o la tabella è
 * oscurata e lui non è il Master, la tabella per lui non c'è (null).
 */
export function rollOnTable(pageId: number, block: string, u: Viewer | null, random?: Random): RollResult | null {
	const page = getDb()
		.select({ content: pages.content })
		.from(pages)
		.where(and(eq(pages.id, pageId), visibleTo(u)))
		.get();
	if (!page) return null;
	const doc = visibleBlocks(isDoc(page.content) ? page.content : EMPTY_DOC, (v) => canSeeBlock(v, u));
	const t = findRollTable(doc, block);
	if (!t) return null;
	const read = readRollTable(t);
	if (!read.ok) return read;
	return { ok: true, name: read.table.name, outcome: rollTable(read.table, random) };
}
