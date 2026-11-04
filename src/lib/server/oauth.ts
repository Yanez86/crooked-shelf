import { createHash, timingSafeEqual } from 'node:crypto';
import { createApiToken, newToken } from './auth.ts';

/**
 * Connettore di Claude: OAuth 2.1 con PKCE, solo per dare a un'app il token di /mcp.
 *
 * La registrazione dei client (RFC 7591) è aperta a chiunque, quindi un client registrato non garantirebbe niente:
 * tutti ricevono lo stesso client_id e la sicurezza sta nella pagina di consenso, che mostra il sito a cui va il token.
 */
export const CLIENT_ID = 'claude';

const CODE_TTL = 5 * 60 * 1000;

interface Grant {
	userId: number;
	campaignId: number;
	canWrite: boolean;
	redirectUri: string;
	challenge: string;
	expires: number;
}

// ponytail: in memoria, un riavvio fa perdere i collegamenti in corso (si rifà il consenso); nel database se servirà più di un processo.
const codes = new Map<string, Grant>();

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];
export const isLoopback = (host: string) => LOOPBACK.includes(host);

// I siti di Claude: per gli altri la pagina di consenso chiede una conferma in più, perché il token vale come il Master.
const KNOWN = ['claude.ai', 'claude.com', 'anthropic.com'];
export const isKnownHost = (host: string) => isLoopback(host) || KNOWN.some((k) => host === k || host.endsWith('.' + k));

/** Quanti codici in attesa per persona: oltre, il più vecchio se ne va. */
const CODES_PER_USER = 10;

/** Dove si può mandare il codice: un sito in HTTPS, o un programma su questo computer (Claude Code), su qualsiasi porta. */
export function redirectHost(uri: unknown): string | null {
	if (typeof uri !== 'string' || uri.length > 2000) return null;
	try {
		const u = new URL(uri);
		if (u.username || u.password || u.hash) return null;
		if (u.protocol === 'https:') return u.hostname;
		return u.protocol === 'http:' && isLoopback(u.hostname) ? u.hostname : null;
	} catch {
		return null;
	}
}

/** Dopo il consenso: un codice da scambiare col token entro pochi minuti, una volta sola. */
export function issueCode(grant: Omit<Grant, 'expires'>): string {
	const now = Date.now();
	for (const [k, g] of codes) if (g.expires < now) codes.delete(k);
	const mine = [...codes].filter(([, g]) => g.userId === grant.userId);
	if (mine.length >= CODES_PER_USER) codes.delete(mine[0][0]);
	const code = newToken();
	codes.set(code, { ...grant, expires: now + CODE_TTL });
	return code;
}

const pkce = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** Il codice diventa un token di /mcp se arriva allo stesso indirizzo di ritorno col verificatore giusto; null altrimenti. */
export function redeemCode(code: string, redirectUri: string, verifier: string): string | null {
	const g = codes.get(code);
	codes.delete(code);
	if (!g || g.expires < Date.now() || g.redirectUri !== redirectUri) return null;
	const a = Buffer.from(pkce(verifier));
	const b = Buffer.from(g.challenge);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	return createApiToken(g.userId, g.campaignId, g.canWrite, redirectHost(g.redirectUri)!);
}
