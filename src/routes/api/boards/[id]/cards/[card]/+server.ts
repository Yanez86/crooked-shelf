import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canSeeBoard, cardInBoard, columnInBoard, getBoard, placeCard } from '#lib/server/boards.ts';

/** Trascinamento di una scheda in un'altra posizione. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const b = getBoard(Number(params.id));
	if (!b || !canSeeBoard(b, locals.user)) error(404, 'Not found');
	const card = cardInBoard(Number(params.card), b.id);
	const body = await request.json().catch(() => ({}));
	const column = Number(body.columnId);
	const index = Number(body.index);
	if (!card || !columnInBoard(column, b.id) || !Number.isInteger(index)) error(400, 'Bad request');
	placeCard(card.id, column, index);
	return json({ ok: true });
};
