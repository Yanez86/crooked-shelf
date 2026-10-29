import { beforeEach, describe, expect, it } from 'vitest';
import { useMemoryDb, schema } from './db/index.ts';
import { backlinks, createPage, getPageBySlug, listPages, renderPage, suggestPages, updatePage } from './pages.ts';
import { searchPages } from './search.ts';
import { categoryTree, createCategory, listTags } from './taxonomy.ts';
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

const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [] };

describe('pagine', () => {
	it('crea, collega e trova i backlink', () => {
		createPage({ ...base, title: 'Bartolo', content: doc(p('Il locandiere')) }, master);
		createPage({ ...base, title: 'Locanda del Grifone', content: doc(link('bartolo')) }, master);
		expect(backlinks('bartolo', alice).map((b) => b.title)).toEqual(['Locanda del Grifone']);
		const html = renderPage(getPageBySlug('locanda-del-grifone')!, alice, labels);
		expect(html).toContain('href="/wiki/bartolo">Bartolo</a>');
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
		expect(renderPage(getPageBySlug('torre')!, alice, labels)).not.toContain('tesoro');
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
