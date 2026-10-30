import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPageBySlug } from '#lib/server/pages.ts';
import { usableBoard } from '#lib/server/boardPage.ts';
import { cardInBoard, columnInBoard, placeCard } from '#lib/server/boards.ts';

/** Trascinamento di una scheda della bacheca in un'altra posizione. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const b = usableBoard(getPageBySlug(params.slug), locals.user);
	const card = cardInBoard(Number(params.card), b.id);
	const body = await request.json().catch(() => ({}));
	const column = Number(body.columnId);
	const index = Number(body.index);
	if (!card || !columnInBoard(column, b.id) || !Number.isInteger(index)) error(400, 'Bad request');
	placeCard(card.id, column, index);
	return json({ ok: true });
};
