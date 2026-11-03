import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Connettore di Claude (RFC 8414): dove chiedere il consenso, registrarsi e prendere il token. */
export const GET: RequestHandler = ({ url }) =>
	json({
		issuer: url.origin,
		authorization_endpoint: `${url.origin}/oauth/authorize`,
		token_endpoint: `${url.origin}/oauth/token`,
		registration_endpoint: `${url.origin}/oauth/register`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none']
	});
