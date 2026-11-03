import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleMcp } from '#lib/server/mcp.ts';

/**
 * MCP per Claude: un messaggio a richiesta, senza sessione. L'utente e la campagna vengono dal token (hooks.server.ts).
 * /mcp è per il plugin di Claude Code; /mcp/<campagna> per il connettore di claude.ai, uno per campagna.
 */
export const POST: RequestHandler = async ({ request, locals, url, params }) => {
	// Il connettore da qui trova dove chiedere il token (OAuth); il plugin il token lo ha già.
	const challenge = params.id ? `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource/mcp/${params.id}"` : 'Bearer';
	if (!locals.user || !locals.campaign) return new Response(null, { status: 401, headers: { 'WWW-Authenticate': challenge } });
	const message = await request.json().catch(() => null);
	if (!message || typeof message !== 'object') return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
	const reply = handleMcp(message, locals.user, locals.campaign.name, locals.locale, locals.mcpWrite);
	return reply ? json(reply) : new Response(null, { status: 202 });
};
