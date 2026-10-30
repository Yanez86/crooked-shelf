import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';

const { boards, boardColumns: cols, boardCards: cards, users } = schema;

// Le bacheche sono pagine «bacheca»: chi vede la pagina usa le schede, chi la modifica cambia le colonne (boardPage.ts).

export const CARD_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'gray'] as const;
export type BoardRow = typeof boards.$inferSelect;

/** La bacheca di una pagina «bacheca». */
export function boardOfPage(pageId: number) {
	return getDb().select().from(boards).where(eq(boards.pageId, pageId)).get();
}

/** Crea la bacheca di una pagina appena nata, con le sue colonne. */
export function createBoard(pageId: number, title: string, columns: string[], userId: number | null): number {
	const db = getDb();
	return db.transaction(() => {
		const id = db
			.insert(boards)
			.values({ title, ownerId: null, visibility: 'players', createdBy: userId, createdAt: Date.now(), pageId })
			.returning({ id: boards.id })
			.get().id;
		columns.forEach((c, i) => db.insert(cols).values({ boardId: id, title: c, sort: i }).run());
		return id;
	});
}

/** Le colonne scritte una per riga (al massimo 12). */
export function readColumns(raw: unknown): string[] {
	return String(raw ?? '')
		.split('\n')
		.map((c) => c.trim().slice(0, 60))
		.filter(Boolean)
		.slice(0, 12);
}

export function boardContent(id: number) {
	const db = getDb();
	const columns = db.select().from(cols).where(eq(cols.boardId, id)).orderBy(asc(cols.sort), asc(cols.id)).all();
	const all = db
		.select({
			id: cards.id,
			columnId: cards.columnId,
			title: cards.title,
			body: cards.body,
			color: cards.color,
			sort: cards.sort,
			author: users.displayName,
			updatedAt: cards.updatedAt
		})
		.from(cards)
		.innerJoin(cols, eq(cols.id, cards.columnId))
		.leftJoin(users, eq(users.id, cards.createdBy))
		.where(eq(cols.boardId, id))
		.orderBy(asc(cards.sort), asc(cards.id))
		.all();
	return columns.map((c) => ({ id: c.id, title: c.title, cards: all.filter((k) => k.columnId === c.id) }));
}

const colOf = (columnId: number) => getDb().select().from(cols).where(eq(cols.id, columnId)).get();

/** La colonna appartiene a questa bacheca? */
export const columnInBoard = (columnId: number, boardId: number) => colOf(columnId)?.boardId === boardId;

export function cardInBoard(cardId: number, boardId: number) {
	const c = getDb().select().from(cards).where(eq(cards.id, cardId)).get();
	return c && colOf(c.columnId)?.boardId === boardId ? c : undefined;
}

export function addColumn(boardId: number, title: string) {
	const n = getDb().select({ n: sql<number>`count(*)` }).from(cols).where(eq(cols.boardId, boardId)).get()?.n ?? 0;
	getDb().insert(cols).values({ boardId, title, sort: n }).run();
}

export function renameColumn(id: number, title: string) {
	getDb().update(cols).set({ title }).where(eq(cols.id, id)).run();
}

export function deleteColumn(id: number) {
	getDb().delete(cols).where(eq(cols.id, id)).run();
}

/** Sposta una colonna a sinistra (-1) o a destra (+1). */
export function shiftColumn(boardId: number, id: number, dir: -1 | 1) {
	const list = getDb().select().from(cols).where(eq(cols.boardId, boardId)).orderBy(asc(cols.sort), asc(cols.id)).all();
	const i = list.findIndex((c) => c.id === id);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= list.length) return;
	[list[i], list[j]] = [list[j], list[i]];
	getDb().transaction((tx) => list.forEach((c, k) => tx.update(cols).set({ sort: k }).where(eq(cols.id, c.id)).run()));
}

export function addCard(columnId: number, input: { title: string; body: string; color: string }, userId: number) {
	const n = getDb().select({ n: sql<number>`count(*)` }).from(cards).where(eq(cards.columnId, columnId)).get()?.n ?? 0;
	const now = Date.now();
	getDb().insert(cards).values({ ...input, columnId, sort: n, createdBy: userId, createdAt: now, updatedAt: now }).run();
}

export function updateCard(id: number, input: { title: string; body: string; color: string }) {
	getDb().update(cards).set({ ...input, updatedAt: Date.now() }).where(eq(cards.id, id)).run();
}

export function deleteCard(id: number) {
	getDb().delete(cards).where(eq(cards.id, id)).run();
}

/** Mette la scheda nella colonna indicata, alla posizione indicata (le altre si spostano). */
export function placeCard(cardId: number, columnId: number, index: number) {
	const db = getDb();
	db.transaction((tx) => {
		const others = tx
			.select({ id: cards.id })
			.from(cards)
			.where(and(eq(cards.columnId, columnId), sql`${cards.id} <> ${cardId}`))
			.orderBy(asc(cards.sort), asc(cards.id))
			.all()
			.map((c) => c.id);
		const at = Math.max(0, Math.min(index, others.length));
		others.splice(at, 0, cardId);
		others.forEach((id, k) => tx.update(cards).set({ sort: k, columnId }).where(eq(cards.id, id)).run());
	});
}

/** Spostamenti da tastiera: su/giù nella colonna, sinistra/destra tra le colonne. */
export function moveCard(boardId: number, cardId: number, dir: 'up' | 'down' | 'left' | 'right') {
	const content = boardContent(boardId);
	const ci = content.findIndex((c) => c.cards.some((k) => k.id === cardId));
	if (ci < 0) return;
	const idx = content[ci].cards.findIndex((k) => k.id === cardId);
	if (dir === 'up' || dir === 'down') {
		const to = idx + (dir === 'up' ? -1 : 1);
		if (to >= 0 && to < content[ci].cards.length) placeCard(cardId, content[ci].id, to);
	} else {
		const target = content[ci + (dir === 'left' ? -1 : 1)];
		if (target) placeCard(cardId, target.id, Math.min(idx, target.cards.length));
	}
}
