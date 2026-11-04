import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, useMemoryDb, schema } from './db/index.ts';
import { FIRST_CAMPAIGN, saveCampaign } from './campaigns.ts';
import { apiTokenAccess, createApiToken, deleteUserSessions, revokeApiToken, validateApiToken } from './auth.ts';
import { createPage, getPageBySlug, listRevisions, pageMeta } from './pages.ts';
import { createCategory } from './taxonomy.ts';
import { handleMcp } from './mcp.ts';
import { resetSettingsCache } from './settings.ts';
import type { DocNode } from '../content/types.ts';

const dm = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };

const para = (t: string): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const base = { playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null };

const call = (u: typeof dm | typeof alice, name: string, args: object = {}, write = false) => {
	const r = handleMcp({ id: 1, method: 'tools/call', params: { name, arguments: args as Record<string, unknown> } }, u, 'Ombre', 'it', write) as { result: { content: { text: string }[]; isError?: boolean } };
	return { text: r.result.content[0].text, isError: r.result.isError ?? false };
};
const write = (u: typeof dm | typeof alice, name: string, args: object) => call(u, name, args, true);

beforeEach(() => {
	const db = useMemoryDb();
	resetSettingsCache();
	for (const u of [dm, alice]) db.insert(schema.users).values({ ...u, username: 'u' + u.id, displayName: 'U' + u.id, passwordHash: 'x', createdAt: 0 }).run();
	saveCampaign(FIRST_CAMPAIGN, { name: 'Ombre', masterId: dm.id });
	createPage({ ...base, title: 'Locanda', visibility: 'players', content: { type: 'doc', content: [para('Birra calda'), { type: 'secret', content: [para('Tesoro nascosto')] }] } }, dm);
	createPage({ ...base, title: 'Piano malvagio', visibility: 'master', content: { type: 'doc', content: [para('Conquista del regno')] } }, dm);
});

describe('segreti', () => {
	it('il giocatore non li legge, non li cerca e non vede le pagine del Master', () => {
		expect(call(alice, 'read_page', { slug: 'locanda' }).text).toContain('Birra calda');
		expect(call(alice, 'read_page', { slug: 'locanda' }).text).not.toContain('Tesoro');
		expect(call(alice, 'search', { query: 'tesoro' }).text).toBe('[]');
		expect(call(alice, 'read_page', { slug: 'piano-malvagio' })).toEqual({ text: 'Pagina non trovata.', isError: true });
		expect(call(alice, 'list_pages').text).not.toContain('Piano');
	});

	it('il Master vede tutto', () => {
		expect(call(dm, 'read_page', { slug: 'locanda' }).text).toContain('Tesoro');
		expect(call(dm, 'search', { query: 'tesoro' }).text).toContain('locanda');
		expect(call(dm, 'list_pages').text).toContain('Piano malvagio');
	});

	it('gli estratti della ricerca non portano i segni di evidenziazione', () => {
		expect(call(dm, 'search', { query: 'birra' }).text).not.toMatch(/\\u000[12]/);
	});
});

describe('protocollo', () => {
	it('risponde con la versione chiesta e dice chi legge cosa', () => {
		const r = handleMcp({ id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, alice, 'Ombre', 'it') as { result: { protocolVersion: string; instructions: string } };
		expect(r.result.protocolVersion).toBe('2025-03-26');
		expect(r.result.instructions).toContain('Ombre');
		expect(r.result.instructions).toContain('giocatore');
	});

	it('le notifiche non hanno risposta, il resto dà errore', () => {
		expect(handleMcp({ method: 'notifications/initialized' }, alice, 'Ombre', 'it')).toBeNull();
		expect(handleMcp({ id: 1, method: 'boh' }, alice, 'Ombre', 'it')).toMatchObject({ error: { code: -32601 } });
		expect(handleMcp({ id: 1, method: 'tools/call', params: { name: 'delete_page' } }, alice, 'Ombre', 'it')).toMatchObject({ error: { code: -32602 } });
	});
});

describe('token', () => {
	const bearer = (t: string) => `Bearer ${t}`;

	it('vale per la sua campagna, e uno nuovo sostituisce il vecchio', () => {
		const first = createApiToken(alice.id, FIRST_CAMPAIGN);
		expect(validateApiToken(bearer(first))).toMatchObject({ user: { id: alice.id }, campaignId: FIRST_CAMPAIGN });
		const second = createApiToken(alice.id, FIRST_CAMPAIGN);
		expect(validateApiToken(bearer(first))).toBeNull();
		expect(validateApiToken(bearer(second))).not.toBeNull();
	});

	it('non vale senza intestazione giusta, revocato, con la password cambiata o con account disattivato', () => {
		expect(validateApiToken(null)).toBeNull();
		const t = createApiToken(alice.id, FIRST_CAMPAIGN);
		expect(validateApiToken(t)).toBeNull();

		revokeApiToken(alice.id, FIRST_CAMPAIGN);
		expect(validateApiToken(bearer(t))).toBeNull();
		expect(apiTokenAccess(alice.id, FIRST_CAMPAIGN)).toBeNull();

		const again = createApiToken(alice.id, FIRST_CAMPAIGN);
		deleteUserSessions(alice.id);
		expect(validateApiToken(bearer(again))).toBeNull();

		const last = createApiToken(alice.id, FIRST_CAMPAIGN);
		getDb().update(schema.users).set({ disabled: true }).where(eq(schema.users.id, alice.id)).run();
		expect(validateApiToken(bearer(last))).toBeNull();
	});

	it('scrive solo se chi lo crea lo chiede, e sostituendolo si può tornare indietro', () => {
		const read = createApiToken(alice.id, FIRST_CAMPAIGN);
		expect(validateApiToken(bearer(read))?.canWrite).toBe(false);
		expect(apiTokenAccess(alice.id, FIRST_CAMPAIGN)).toBe('read');
		expect(validateApiToken(bearer(createApiToken(alice.id, FIRST_CAMPAIGN, true)))?.canWrite).toBe(true);
		expect(apiTokenAccess(alice.id, FIRST_CAMPAIGN)).toBe('write');
		expect(validateApiToken(bearer(createApiToken(alice.id, FIRST_CAMPAIGN)))?.canWrite).toBe(false);
	});
});

describe('scrittura', () => {
	const names = (w: boolean) => (handleMcp({ id: 1, method: 'tools/list' }, dm, 'Ombre', 'it', w) as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);

	it('con un token di sola lettura gli strumenti non esistono', () => {
		expect(names(false)).toEqual(['search', 'read_page', 'list_pages']);
		expect(handleMcp({ id: 1, method: 'tools/call', params: { name: 'create_page', arguments: { title: 'X', text: 'y' } } }, dm, 'Ombre', 'it')).toMatchObject({ error: { code: -32602 } });
		expect(getPageBySlug('x')).toBeUndefined();
	});

	it('si scrive solo testo: nessuno strumento per eliminare, amministrare o cambiare visibilità', () => {
		expect(names(true)).toEqual(['search', 'read_page', 'list_pages', 'create_page', 'append_to_page', 'replace_text']);
		for (const name of ['delete_page', 'set_visibility', 'update_settings', 'install_plugin'])
			expect(handleMcp({ id: 1, method: 'tools/call', params: { name } }, dm, 'Ombre', 'it', true)).toMatchObject({ error: { code: -32602 } });
	});

	it('una pagina nuova la vede solo chi la crea, finché non si chiede altro', () => {
		expect(JSON.parse(write(dm, 'create_page', { title: 'Note', text: 'Appunti del **Master**' }).text)).toMatchObject({ slug: 'note', visibility: 'personal' });
		expect(call(alice, 'read_page', { slug: 'note' }).isError).toBe(true);
		expect(call(dm, 'read_page', { slug: 'note' }).text).toContain('<strong>Master</strong>');
		expect(getPageBySlug('note')).toMatchObject({ kind: 'page', authorId: dm.id, playersCanEdit: false });
	});

	it('il giocatore non può scegliere una visibilità che non ha, né duplicare una pagina', () => {
		expect(write(alice, 'create_page', { title: 'A', text: 'x', visibility: 'master' })).toMatchObject({ isError: true });
		expect(write(alice, 'create_page', { title: 'A', text: 'x', visibility: 'boh' })).toMatchObject({ isError: true });
		expect(write(alice, 'create_page', { title: 'Locanda', text: 'x' }).text).toContain('Esiste già');
		expect(getPageBySlug('locanda-2')).toBeUndefined();
	});

	it('cartella e tag: solo cartelle che esistono', () => {
		createCategory('Luoghi', null);
		expect(write(dm, 'create_page', { title: 'Porto', text: 'x', folder: 'Nessuna' }).text).toContain('Luoghi');
		write(dm, 'create_page', { title: 'Porto', text: 'x', folder: 'Luoghi', tags: ['Mare', 'mare'] });
		const page = getPageBySlug('porto')!;
		expect(page.categoryId).not.toBeNull();
		expect(pageMeta(page).tags.map((t) => t.name)).toEqual(['Mare']);
	});

	it('HTML e script restano testo: nella pagina non arriva nulla di eseguibile', () => {
		write(dm, 'create_page', { title: 'Trappola', text: '<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src=x onerror=alert(1)>' });
		const html = call(dm, 'read_page', { slug: 'trappola' }).text;
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('href=\\"javascript');
	});

	it('aggiungere non tocca nient\'altro e lascia una versione', () => {
		const before = getPageBySlug('locanda')!;
		const versions = listRevisions(before, dm).length;
		write(dm, 'append_to_page', { slug: 'locanda', text: 'Nuova voce' });
		const after = getPageBySlug('locanda')!;
		expect(call(dm, 'read_page', { slug: 'locanda' }).text).toContain('Nuova voce');
		expect(call(dm, 'read_page', { slug: 'locanda' }).text).toContain('Tesoro');
		expect(after).toMatchObject({ title: before.title, visibility: before.visibility, playersCanEdit: false, hasSecret: true, categoryId: before.categoryId });
		expect(listRevisions(after, dm)).toHaveLength(versions + 1);
		expect(call(alice, 'search', { query: 'nuova' }).text).toContain('locanda');
	});

	it('il Master scrive segreti, il giocatore no', () => {
		write(dm, 'append_to_page', { slug: 'locanda', text: 'Piano occulto', secret: true });
		expect(call(alice, 'read_page', { slug: 'locanda' }).text).not.toContain('occulto');
		expect(call(dm, 'read_page', { slug: 'locanda' }).text).toContain('occulto');
		const mine = createPage({ ...base, title: 'Diario', visibility: 'players', content: { type: 'doc', content: [para('Ciao')] } }, alice);
		expect(write(alice, 'append_to_page', { slug: mine.slug, text: 'x', secret: true }).text).toBe('Solo il Master scrive segreti.');
		expect(write(alice, 'append_to_page', { slug: mine.slug, text: '> [!secret]\n> finto' }).isError).toBe(false);
		expect(getPageBySlug(mine.slug)!.hasSecret).toBe(false);
	});

	it('il giocatore modifica solo quello che può modificare nel sito', () => {
		expect(write(alice, 'append_to_page', { slug: 'locanda', text: 'x' }).text).toBe('Non puoi modificare questa pagina.');
		expect(write(alice, 'replace_text', { slug: 'locanda', find: 'Birra', replace: 'Vino' }).text).toBe('Non puoi modificare questa pagina.');
		// Una pagina che non può vedere non deve nemmeno risultare esistente.
		expect(write(alice, 'append_to_page', { slug: 'piano-malvagio', text: 'x' }).text).toBe('Pagina non trovata.');
	});

	it('il giocatore modifica una pagina col segreto del Master: il segreto resta, e dentro non si cerca', () => {
		getDb().update(schema.pages).set({ playersCanEdit: true }).where(eq(schema.pages.slug, 'locanda')).run();
		write(dm, 'append_to_page', { slug: 'locanda', text: 'Tesoro ancora', secret: true });
		expect(write(alice, 'append_to_page', { slug: 'locanda', text: 'Dice Alice' }).isError).toBe(false);
		// «Tesoro» c'è due volte, ma tutte e due nei segreti: per lei non c'è.
		expect(write(alice, 'replace_text', { slug: 'locanda', find: 'Tesoro', replace: 'x' }).text).toContain('Testo non trovato');
		expect(write(alice, 'replace_text', { slug: 'locanda', find: 'Birra calda', replace: 'Birra fredda' }).isError).toBe(false);
		const html = call(dm, 'read_page', { slug: 'locanda' }).text;
		expect(html).toMatch(/Birra fredda.*Tesoro nascosto.*Tesoro ancora.*Dice Alice/s);
		expect(getPageBySlug('locanda')!.hasSecret).toBe(true);
		expect(call(alice, 'read_page', { slug: 'locanda' }).text).not.toContain('Tesoro');
	});

	it('il Master scrive segreti anche nelle schede giocatore', () => {
		const sheet = createPage({ ...base, title: 'Thalia', visibility: 'players', sheetOf: alice.id, content: { type: 'doc', content: [para('Ladra')] } }, alice);
		expect(write(dm, 'append_to_page', { slug: sheet.slug, text: 'È la figlia del duca', secret: true }).isError).toBe(false);
		expect(call(alice, 'read_page', { slug: sheet.slug }).text).not.toContain('duca');
		expect(write(alice, 'append_to_page', { slug: sheet.slug, text: 'Ha un pugnale' }).isError).toBe(false);
		expect(call(dm, 'read_page', { slug: sheet.slug }).text).toMatch(/Ladra.*duca.*pugnale/s);
	});

	it('template, mappe e cronologie non si toccano da qui', () => {
		const tpl = createPage({ ...base, title: 'Modello', visibility: 'players', kind: 'template', content: { type: 'doc', content: [para('Base')] } }, dm);
		expect(write(dm, 'append_to_page', { slug: tpl.slug, text: 'x' }).text).toBe('Non puoi modificare questa pagina.');
	});

	it('sostituisce un pezzo di testo solo se lo trova una volta, senza toccare il resto', () => {
		expect(write(dm, 'replace_text', { slug: 'locanda', find: 'Vino', replace: 'x' })).toMatchObject({ isError: true });
		write(dm, 'append_to_page', { slug: 'locanda', text: 'Birra e Birra' });
		expect(write(dm, 'replace_text', { slug: 'locanda', find: 'Birra', replace: 'x' }).text).toContain('3 volte');
		expect(write(dm, 'replace_text', { slug: 'locanda', find: 'Birra calda', replace: 'Costa $& 2 **ori**' }).isError).toBe(false);
		const out = call(dm, 'read_page', { slug: 'locanda' }).text;
		expect(out).toContain('Costa $&amp; 2 **ori**');
		expect(out).toContain('Tesoro');
		expect(getPageBySlug('locanda')!.hasSecret).toBe(true);
	});

	it('togliere tutto il testo di un nodo non lascia nodi vuoti', () => {
		write(dm, 'replace_text', { slug: 'locanda', find: 'Birra calda', replace: '' });
		const [first] = (getPageBySlug('locanda')!.content as DocNode).content!;
		expect(first).toMatchObject({ type: 'paragraph', content: [] });
		expect(first.content).toEqual([]);
	});

	it('testo vuoto o troppo lungo: non si salva niente', () => {
		expect(write(dm, 'append_to_page', { slug: 'locanda', text: '  \n ' }).text).toBe('Il testo è vuoto.');
		expect(write(dm, 'create_page', { title: 'Lunga', text: 'x'.repeat(100_001) }).isError).toBe(true);
		expect(getPageBySlug('lunga')).toBeUndefined();
	});
});
