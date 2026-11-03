import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CLIENT_ID, redirectHost } from '#lib/server/oauth.ts';

/** Registrazione del client (RFC 7591): niente da salvare, vedi oauth.ts. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const uris: unknown = body?.redirect_uris;
	if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every((u) => redirectHost(u)))
		return json({ error: 'invalid_redirect_uri' }, { status: 400 });
	return json(
		{
			client_id: CLIENT_ID,
			client_id_issued_at: Math.floor(Date.now() / 1000),
			redirect_uris: uris,
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code'],
			response_types: ['code']
		},
		{ status: 201 }
	);
};
