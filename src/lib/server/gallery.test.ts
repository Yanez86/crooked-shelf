import { beforeEach, describe, expect, it } from 'vitest';
import { useMemoryDb, schema } from './db/index.ts';
import { createPage, getPageBySlug, listRevisions, setPageImage } from './pages.ts';
import { createCategory, pageTree } from './taxonomy.ts';
import { galleryImages } from './gallery.ts';
import { createMap } from './maps.ts';
import type { DocNode } from '../content/types.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null, content: { type: 'doc' } };

const img = (id: string, alt = ''): DocNode => ({ type: 'image', attrs: { src: `/files/${id}`, alt } });
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });

beforeEach(() => {
	const db = useMemoryDb();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player']
	] as const)
		db.insert(schema.users).values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 }).run();
	for (const [i, id] of ['cover', 'inline', 'secret', 'gm', 'diary', 'map'].entries())
		db.insert(schema.files).values({ id: id + 'xxxxxxxx', sha256: id, name: id + '.png', mime: 'image/png', size: 1, width: 40, height: 30, createdAt: i }).run();
});

const ids = (u: typeof master | typeof alice | null) => galleryImages(u).map((i) => i.id.replace(/x+$/, ''));

describe('immagine della pagina', () => {
	it('si salva senza creare versioni né cambiare la data di modifica', () => {
		const pg = createPage({ ...base, title: 'Elminster' }, alice);
		setPageImage(pg.id, 'coverxxxxxxxx');
		const after = getPageBySlug('elminster')!;
		expect(after.imageId).toBe('coverxxxxxxxx');
		expect(after.updatedAt).toBe(pg.updatedAt);
		expect(listRevisions(after, master)).toHaveLength(1);
		setPageImage(pg.id, null);
		expect(getPageBySlug('elminster')!.imageId).toBeNull();
	});
});

describe('galleria', () => {
	beforeEach(() => {
		const el = createPage({ ...base, title: 'Elminster', content: doc(img('inlinexxxxxxxx', 'Torre di Elminster'), { type: 'secret', content: [img('secretxxxxxxxx')] }) }, master);
		setPageImage(el.id, 'coverxxxxxxxx');
		const gm = createPage({ ...base, visibility: 'master', title: 'Piano', content: doc(img('gmxxxxxxxx')) }, master);
		setPageImage(gm.id, 'inlinexxxxxxxx');
		createPage({ ...base, visibility: 'personal', title: 'Diario', content: doc(img('diaryxxxxxxxx')) }, alice);
		createMap({ title: 'Faerûn', description: '', visibility: 'players', parentId: null, scale: null, unit: '' }, { id: 'mapxxxxxxxx', width: 40, height: 30 }, 1);
	});

	it('il giocatore vede solo le immagini delle pagine e delle mappe che può leggere', () => {
		expect(ids(alice)).toEqual(['map', 'diary', 'inline', 'cover']);
		expect(ids(master)).toEqual(['map', 'gm', 'secret', 'inline', 'cover']);
		expect(ids(null)).toEqual([]);
	});

	it('dice dove compare ogni immagine, senza rivelare le pagine nascoste', () => {
		const inline = (u: typeof master | typeof alice) => galleryImages(u).find((i) => i.id.startsWith('inline'))!;
		expect(inline(alice).alt).toBe('Torre di Elminster');
		expect(inline(alice).sources).toEqual([{ kind: 'content', title: 'Elminster', href: '/wiki/elminster' }]);
		expect(inline(master).sources.map((s) => `${s.kind}:${s.title}`)).toEqual(['content:Elminster', 'cover:Piano']);
		const cover = galleryImages(alice).find((i) => i.id.startsWith('cover'))!;
		expect(cover).toMatchObject({ url: '/files/coverxxxxxxxx', alt: 'Elminster', width: 40, height: 30 });
		expect(galleryImages(alice).find((i) => i.id.startsWith('map'))!.sources).toEqual([{ kind: 'map', title: 'Faerûn', href: '/maps/faerun' }]);
	});
});

describe('albero nella barra laterale', () => {
	it('mostra solo le pagine visibili; le cartelle vuote solo al Master', () => {
		const luoghi = createCategory('Luoghi', null);
		createCategory('Segreti', null);
		createPage({ ...base, title: 'Waterdeep', categoryId: luoghi.id }, master);
		createPage({ ...base, visibility: 'master', title: 'Covo', categoryId: luoghi.id }, master);
		createPage({ ...base, title: 'Bartolo' }, master);

		const forAlice = pageTree(alice);
		expect(forAlice.folders.map((f) => [f.name, f.pages.map((p) => p.title)])).toEqual([['Luoghi', ['Waterdeep']]]);
		expect(forAlice.pages.map((p) => p.title)).toEqual(['Bartolo']);
		const forMaster = pageTree(master);
		expect(forMaster.folders.map((f) => [f.name, f.pages.map((p) => p.title)])).toEqual([
			['Luoghi', ['Covo', 'Waterdeep']],
			['Segreti', []]
		]);
	});
});
