import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleMcp } from '#lib/server/mcp.ts';

/** MCP per il plugin di Claude: un messaggio a richiesta, senza sessione. L'utente e la campagna vengono dal token (hooks.server.ts). */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.campaign) return new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
	const message = await request.json().catch(() => null);
	if (!message || typeof message !== 'object') return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
	const reply = handleMcp(message, locals.user, locals.campaign.name, locals.locale, locals.mcpWrite);
	return reply ? json(reply) : new Response(null, { status: 202 });
};
