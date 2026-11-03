import { beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { useMemoryDb, schema } from './db/index.ts';
import { FIRST_CAMPAIGN, saveCampaign } from './campaigns.ts';
import { apiTokenAccess, apiTokenClients, createApiToken, revokeApiToken, validateApiToken } from './auth.ts';
import { issueCode, redeemCode, redirectHost } from './oauth.ts';
import { resetSettingsCache } from './settings.ts';

const verifier = 'v'.repeat(50);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const back = 'https://claude.ai/api/mcp/auth_callback';
const grant = { userId: 1, campaignId: FIRST_CAMPAIGN, canWrite: false, redirectUri: back, challenge };

beforeEach(() => {
	useMemoryDb().insert(schema.users).values({ id: 1, role: 'master', username: 'dm', displayName: 'DM', passwordHash: 'x', createdAt: 0 }).run();
	resetSettingsCache();
	saveCampaign(FIRST_CAMPAIGN, { name: 'Ombre', masterId: 1 });
});

describe('indirizzo di ritorno', () => {
	it('un sito in HTTPS o un programma su questo computer, su qualsiasi porta', () => {
		expect(redirectHost(back)).toBe('claude.ai');
		expect(redirectHost('http://localhost:3118/callback')).toBe('localhost');
		expect(redirectHost('http://127.0.0.1:50000/callback')).toBe('127.0.0.1');
		for (const bad of ['http://claude.ai/cb', 'javascript:alert(1)', 'https://a@claude.ai/', 'https://claude.ai/#x', 'nonunurl', 42, null])
			expect(redirectHost(bad), String(bad)).toBeNull();
	});
});

describe('codice', () => {
	it('diventa un token di /mcp una volta sola, col verificatore giusto', () => {
		const code = issueCode(grant);
		const token = redeemCode(code, back, verifier)!;
		expect(validateApiToken(`Bearer ${token}`)).toMatchObject({ campaignId: FIRST_CAMPAIGN, canWrite: false });
		expect(redeemCode(code, back, verifier)).toBeNull();
	});

	it('niente token con un verificatore sbagliato o un altro indirizzo, e il codice non si riprova', () => {
		const code = issueCode(grant);
		expect(redeemCode(code, back, 'w'.repeat(50))).toBeNull();
		expect(redeemCode(code, back, verifier)).toBeNull();
		expect(redeemCode(issueCode(grant), 'https://evil.example/cb', verifier)).toBeNull();
	});

	it('il connettore non sostituisce il token del profilo, e Revoca li chiude tutti', () => {
		const own = createApiToken(1, FIRST_CAMPAIGN, true);
		const connector = redeemCode(issueCode(grant), back, verifier)!;
		expect(apiTokenAccess(1, FIRST_CAMPAIGN)).toBe('write');
		expect(apiTokenClients(1, FIRST_CAMPAIGN)).toEqual(['claude.ai']);
		expect(validateApiToken(`Bearer ${own}`)).not.toBeNull();
		revokeApiToken(1, FIRST_CAMPAIGN);
		expect(validateApiToken(`Bearer ${own}`)).toBeNull();
		expect(validateApiToken(`Bearer ${connector}`)).toBeNull();
	});
});
