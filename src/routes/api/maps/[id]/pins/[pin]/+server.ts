import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isMaster } from '#lib/access.ts';
import { getMap, getPin, movePin } from '#lib/server/maps.ts';

/** Spostamento di un pin trascinandolo sulla mappa. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!isMaster(locals.user)) error(404, 'Not found');
	const map = getMap(Number(params.id));
	const pin = getPin(Number(params.pin));
	if (!map || !pin || pin.mapId !== map.id) error(404, 'Not found');
	const body = await request.json().catch(() => ({}));
	const x = Number(body.x);
	const y = Number(body.y);
	if (!Number.isFinite(x) || !Number.isFinite(y)) error(400, 'Bad position');
	movePin(map.id, pin.id, Math.min(map.width, Math.max(0, x)), Math.min(map.height, Math.max(0, y)));
	return json({ ok: true });
};
