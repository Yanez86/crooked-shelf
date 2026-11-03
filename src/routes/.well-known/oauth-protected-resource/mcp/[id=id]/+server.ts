import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Connettore di Claude (RFC 9728): /mcp/<campagna> si apre col token che dà questa stessa wiki, per quella campagna. */
export const GET: RequestHandler = ({ url, params }) => json({ resource: `${url.origin}/mcp/${params.id}`, authorization_servers: [url.origin] });
