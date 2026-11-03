import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { redeemCode } from '#lib/server/oauth.ts';

const NO_STORE = { 'Cache-Control': 'no-store' };
const fail = (error: string) => json({ error }, { status: 400, headers: NO_STORE });

/** Scambio del codice col token (RFC 6749 4.1.3). Lo chiamano i server di Claude, senza Origin: vedi il controllo dei form in hooks.server.ts. */
export const POST: RequestHandler = async ({ request }) => {
	const f = await request.formData().catch(() => null);
	if (!f) return fail('invalid_request');
	if (f.get('grant_type') !== 'authorization_code') return fail('unsupported_grant_type');
	const token = redeemCode(String(f.get('code') ?? ''), String(f.get('redirect_uri') ?? ''), String(f.get('code_verifier') ?? ''));
	if (!token) return fail('invalid_grant');
	return json({ access_token: token, token_type: 'Bearer' }, { headers: NO_STORE });
};
