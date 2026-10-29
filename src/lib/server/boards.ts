import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { isMaster, type Viewer } from '../access.ts';

const { boards, boardColumns: cols, boardCards: cards, users } = schema;

export const CARD_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'gray'] as const;
export type BoardRow = typeof boards.$inferSelect;

/** Bacheca personale: solo il proprietario. Condivisa: i giocatori o solo il Master. */
export function canSeeBoard(b: Pick<BoardRow, 'ownerId' | 'visibility'>, u: Viewer | null): boolean {
	if (!u) return false;
	if (b.ownerId !== null) return b.ownerId === u.id;
	return b.visibility === 'players' || isMaster(u);
}

/** Rinominare, cambiare colonne o eliminare: il proprietario, o il Master per quelle condivise. */
export function canManageBoard(b: Pick<BoardRow, 'ownerId' | 'visibility'>, u: Viewer | null): boolean {
	if (!u) return false;
	return b.ownerId !== null ? b.ownerId === u.id : isMaster(u);
}

export function listBoards(u: Viewer) {
	const shared = isMaster(u) ? isNull(boards.ownerId) : and(isNull(boards.ownerId), eq(boards.visibility, 'players'));
	return getDb()
		.select({
			id: boards.id,
			title: boards.title,
			ownerId: boards.ownerId,
			visibility: boards.visibility,
			cards: sql<number>`(SELECT count(*) FROM board_cards c JOIN board_columns k ON k.id = c.column_id WHERE k.board_id = "boards"."id")`
		})
		.from(boards)
		.where(or(eq(boards.ownerId, u.id), shared))
		.orderBy(asc(boards.title))
		.all();
}

export function getBoard(id: number) {
	return getDb().select().from(boards).where(eq(boards.id, id)).get();
}

export function createBoard(title: string, personal: boolean, visibility: 'players' | 'master', columns: string[], u: Viewer): number {
	const db = getDb();
	return db.transaction(() => {
		const id = db
			.insert(boards)
			.values({ title, ownerId: personal ? u.id : null, visibility: personal ? 'players' : visibility, createdBy: u.id, createdAt: Date.now() })
			.returning({ id: boards.id })
			.get().id;
		columns.forEach((c, i) => db.insert(cols).values({ boardId: id, title: c, sort: i }).run());
		return id;
	});
}

export function updateBoard(id: number, title: string, visibility: 'players' | 'master') {
	getDb().update(boards).set({ title, visibility }).where(eq(boards.id, id)).run();
}

export function deleteBoard(id: number) {
	getDb().delete(boards).where(eq(boards.id, id)).run();
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
