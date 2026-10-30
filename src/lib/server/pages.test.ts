import { beforeEach, describe, expect, it } from 'vitest';
import { useMemoryDb, schema } from './db/index.ts';
import { backlinks, createPage, findPageChoice, getPageBySlug, listPages, pageChoices, pageMeta, renderPage, suggestPages, updatePage } from './pages.ts';
import { searchPages } from './search.ts';
import { categoryTree, createCategory, listTags, pageTree } from './taxonomy.ts';
import { readPageForm } from './pageForm.ts';
import type { DocNode } from '../content/types.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };
const labels = { secret: 'S', note: 'N', tip: 'T', warning: 'W', missing: 'M' };

const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
const p = (text: string): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const link = (target: string): DocNode => ({
	type: 'paragraph',
	content: [{ type: 'wikiLink', attrs: { target, title: target } }]
});

beforeEach(() => {
	const db = useMemoryDb();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player']
	] as const)
		db.insert(schema.users)
			.values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 })
			.run();
});

const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null };

describe('pagine', () => {
	it("l'icona scelta arriva nell'albero; una modifica senza icona la lascia", () => {
		const form = (icon: string) => {
			const f = new FormData();
			f.set('title', 'Drago');
			f.set('content', JSON.stringify(doc(p('x'))));
			f.set('visibility', 'players');
			f.set('icon', icon);
			return f;
		};
		const cal = { months: [] } as never;
		const bad = readPageForm(form('<b>'), master, cal);
		expect(bad.ok && bad.input.icon).toBeNull();
		// Le emoji di prima diventano il nome dell'icona.
		expect(readPageForm(form('🐉'), master, cal)).toMatchObject({ ok: true, input: { icon: 'claws' } });
		const r = readPageForm(form('claws'), master, cal);
		if (!r.ok) throw new Error(r.error);
		const row = createPage(r.input, master);
		expect(pageTree(alice).pages).toEqual([{ slug: 'drago', title: 'Drago', icon: 'claws', kind: 'page' }]);
		updatePage(row, { ...base, title: 'Drago', content: doc(p('y')) }, master, true);
		expect(getPageBySlug('drago')!.icon).toBe('claws');
	});

	it('crea, collega e trova i backlink', () => {
		createPage({ ...base, title: 'Bartolo', content: doc(p('Il locandiere')) }, master);
		createPage({ ...base, title: 'Locanda del Grifone', content: doc(link('bartolo')) }, master);
		expect(backlinks('bartolo', alice).map((b) => b.title)).toEqual(['Locanda del Grifone']);
		const html = renderPage(getPageBySlug('locanda-del-grifone')!, alice, labels).html;
		expect(html).toContain('href="/wiki/bartolo" data-title="Bartolo" data-excerpt="Il locandiere">Bartolo</a>');
	});

	it("l'anteprima del collegamento non mostra i segreti", () => {
		createPage(
			{ ...base, title: 'Bartolo', content: doc(p('Il locandiere'), { type: 'secret', content: [p('è una spia')] }) },
			master
		);
		createPage({ ...base, title: 'Locanda', content: doc(link('bartolo')) }, master);
		const html = renderPage(getPageBySlug('locanda')!, master, labels).html;
		expect(html).toContain('data-excerpt="Il locandiere"');
		expect(html).not.toContain('spia');
	});

	it('indirizzi unici', () => {
		const a = createPage({ ...base, title: 'Drago', content: doc() }, master);
		const b = createPage({ ...base, title: 'Drago', content: doc() }, master);
		expect([a.slug, b.slug]).toEqual(['drago', 'drago-2']);
	});

	it('i giocatori non vedono pagine e segreti del Master, neanche cercando', () => {
		createPage({ ...base, visibility: 'master', title: 'Piano malvagio', content: doc(p('drago nascosto')) }, master);
		createPage(
			{
				...base,
				title: 'Torre',
				content: doc(p('Una torre antica'), { type: 'secret', content: [p('tesoro sotterraneo'), link('piano-malvagio')] })
			},
			master
		);
		expect(listPages(alice).rows.map((r) => r.title)).toEqual(['Torre']);
		expect(searchPages('drago', alice)).toEqual([]);
		expect(searchPages('tesoro', alice)).toEqual([]);
		expect(searchPages('tesoro', master).map((h) => h.title)).toEqual(['Torre']);
		expect(searchPages('antica', alice).map((h) => h.title)).toEqual(['Torre']);
		expect(backlinks('piano-malvagio', alice)).toEqual([]);
		expect(backlinks('piano-malvagio', master).map((b) => b.title)).toEqual(['Torre']);
		expect(suggestPages('pia', alice)).toEqual([]);
		expect(suggestPages('pia', master).map((s) => s.slug)).toEqual(['piano-malvagio']);
		expect(renderPage(getPageBySlug('torre')!, alice, labels).html).not.toContain('tesoro');
	});

	it('un giocatore non può scrivere segreti né cambiare la visibilità altrui', () => {
		const pg = createPage(
			{ ...base, title: 'Diario', content: doc({ type: 'secret', content: [p('furbata')] }) },
			alice
		);
		expect(pg.hasSecret).toBe(false);
		updatePage(pg, { ...base, visibility: 'master', title: 'Diario', content: doc(p('ok')) }, alice, false);
		expect(getPageBySlug('diario')!.visibility).toBe('players');
	});

	it('pagine con lo stesso titolo: nei suggerimenti hanno anche l’indirizzo e si possono scegliere', () => {
		createPage({ ...base, title: 'Elminster', content: doc(p('a')) }, master);
		expect(createPage({ ...base, title: 'Elminster', content: doc(p('b')) }, master).slug).toBe('elminster-2');
		createPage({ ...base, visibility: 'master', title: 'Torre', content: doc(p('c')) }, master);
		expect(pageChoices(master).map((c) => c.label)).toEqual(['Elminster (elminster)', 'Elminster (elminster-2)', 'Torre']);
		expect(findPageChoice('Elminster (elminster-2)', master)?.slug).toBe('elminster-2');
		expect(findPageChoice('elminster (elminster-2)', master)?.slug).toBe('elminster-2');
		// Col solo titolo vince la prima, come prima.
		expect(findPageChoice('Elminster', master)?.slug).toBe('elminster');
		// Il giocatore non sceglie (e non vede) le pagine del Master.
		expect(pageChoices(alice).map((c) => c.label)).toEqual(['Elminster (elminster)', 'Elminster (elminster-2)']);
		expect(findPageChoice('Torre', alice)).toBeUndefined();
	});

	it('una pagina rinominata si collega col titolo nuovo', () => {
		const pg = createPage({ ...base, title: 'Locanda del Grifone', content: doc(p('x')) }, master);
		updatePage(pg, { ...base, title: 'Locanda', content: doc(p('x')) }, master, true);
		expect(findPageChoice('Locanda', master)?.slug).toBe('locanda-del-grifone');
		expect(findPageChoice('Taverna nuova', master)).toBeUndefined();
	});

	it("chi l'ha creata resta, l'ultima modifica cambia con chi salva", () => {
		const pg = createPage({ ...base, playersCanEdit: true, title: 'Taverna', content: doc(p('x')) }, master);
		expect(pageMeta(pg)).toMatchObject({ author: 'U1', editor: 'U1' });
		updatePage(pg, { ...base, playersCanEdit: true, title: 'Taverna', content: doc(p('y')) }, alice, false);
		const after = getPageBySlug('taverna')!;
		expect(pageMeta(after)).toMatchObject({ author: 'U1', editor: 'U2' });
		expect(after.updatedAt).toBeGreaterThan(pg.updatedAt);
	});

	it('ricerca con accenti e prefissi', () => {
		createPage({ ...base, title: 'Città', content: doc(p('Neverwinter è grande')) }, master);
		expect(searchPages('citta', alice).map((h) => h.title)).toEqual(['Città']);
		expect(searchPages('never', alice)[0].snippet).toContain('\u0001');
		expect(searchPages('"; DROP TABLE pages; --', alice)).toEqual([]);
	});

	it('categorie e tag contano solo le pagine visibili', () => {
		const c = createCategory('Luoghi', null);
		createPage({ ...base, title: 'A', categoryId: c.id, tags: ['Nord', 'nord', 'Città'], content: doc() }, master);
		createPage({ ...base, visibility: 'master', title: 'B', categoryId: c.id, tags: ['Segreto'], content: doc() }, master);
		expect(categoryTree(alice).flat[0].count).toBe(1);
		expect(categoryTree(master).flat[0].count).toBe(2);
		expect(listTags(alice).map((t) => t.name)).toEqual(['Città', 'Nord']);
	});
});
