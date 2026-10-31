import type { TreeNode } from '../tree.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { useMemoryDb, schema } from './db/index.ts';
import { MIGRATIONS } from './db/migrations.ts';
import { createPage, getPageBySlug, pageCover, renderPage, updatePage } from './pages.ts';
import { readPageForm } from './pageForm.ts';
import { createCategory, pageTree } from './taxonomy.ts';
import { galleryImages } from './gallery.ts';
import { createMap } from './maps.ts';
import type { DocNode, PageField } from '../content/types.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null, content: { type: 'doc' } };

const img = (id: string, alt = ''): DocNode => ({ type: 'image', attrs: { src: `/files/${id}`, alt } });
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
const pic = (id: string, label = ''): PageField => ({ label, value: '', image: id });
const labels = { secret: 'S', note: 'N', tip: 'T', warning: 'W', missing: 'M' };

beforeEach(() => {
	const db = useMemoryDb();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player']
	] as const)
		db.insert(schema.users).values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 }).run();
	for (const [i, id] of ['cover', 'inline', 'secret', 'gm', 'diary', 'map'].entries())
		db.insert(schema.files).values({ id: id + 'xxxxxxxx', sha256: id, name: id + '.png', mime: 'image/png', size: 1, width: 40, height: 30, createdAt: i }).run();
	db.insert(schema.files).values({ id: 'pdfxxxxxxxxxx', sha256: 'pdf', name: 'a.pdf', mime: 'application/pdf', size: 1, width: 0, height: 0, createdAt: 9 }).run();
});

const ids = (u: typeof master | typeof alice | null) => galleryImages(u).map((i) => i.id.replace(/x+$/, ''));

describe('colonna a lato', () => {
	it("la prima immagine che c'è è l'immagine della pagina", () => {
		const fields = [{ label: 'Razza', value: 'Elfo' }, pic('missingxxxxxx'), pic('coverxxxxxxxx', 'Il mago'), pic('inlinexxxxxxxx')];
		const pg = createPage({ ...base, title: 'Elminster', fields }, alice);
		expect(pg.imageId).toBe('coverxxxxxxxx');
		// Il riquadro con il file che non c'è più non si mostra.
		expect(renderPage(pg, alice, labels).fields).toEqual([
			{ label: 'Razza', html: 'Elfo' },
			{ label: 'Il mago', html: '', image: { url: '/files/coverxxxxxxxx', width: 40, height: 30 } },
			{ label: '', html: '', image: { url: '/files/inlinexxxxxxxx', width: 40, height: 30 } }
		]);
		updatePage(pg, { ...base, title: 'Elminster', fields: [fields[0]] }, alice, false);
		expect(getPageBySlug('elminster')!.imageId).toBeNull();
	});

	it('il modulo tiene solo le immagini caricate, con la didascalia', () => {
		const f = new FormData();
		f.set('title', 'Elminster');
		f.set('visibility', 'players');
		f.set('content', JSON.stringify(doc()));
		f.set('fields', JSON.stringify([pic('coverxxxxxxxx', '  Il mago  '), pic('pdfxxxxxxxxxx'), pic('nonesistexxxx'), pic(''), { label: 'Età', value: '', image: 3 }, { label: '', value: '' }, { label: 'Razza', value: 'Elfo' }]));
		const r = readPageForm(f, master, { months: [] } as never);
		if (!r.ok) throw new Error(r.error);
		expect(r.input.fields).toEqual([pic('coverxxxxxxxx', 'Il mago'), { label: 'Razza', value: 'Elfo' }]);
	});

	it("la migrazione porta l'immagine della pagina nel primo riquadro", () => {
		const conn = new Database(':memory:');
		conn.pragma('foreign_keys = OFF');
		// Cercata per contenuto: dopo ne possono venire altre.
		const cover = MIGRATIONS.findIndex((m) => typeof m === 'string' && m.includes("'image', image_id"));
		for (const m of MIGRATIONS.slice(0, cover)) conn.exec(m as string);
		const insert = conn.prepare("INSERT INTO pages (slug, title, content, visibility, created_at, updated_at, fields, image_id) VALUES (?, ?, '{}', 'players', 0, 0, ?, ?)");
		insert.run('a', 'A', '[]', 'coverxxxxxxxx');
		insert.run('b', 'B', '[{"label":"Razza","value":"Elfo"}]', 'coverxxxxxxxx');
		insert.run('c', 'C', '[{"label":"Razza","value":"Elfo"}]', null);
		conn.exec(MIGRATIONS[cover] as string);
		const fields = (slug: string) => JSON.parse((conn.prepare('SELECT fields FROM pages WHERE slug = ?').get(slug) as { fields: string }).fields);
		expect(fields('a')).toEqual([pic('coverxxxxxxxx')]);
		expect(fields('b')).toEqual([pic('coverxxxxxxxx'), { label: 'Razza', value: 'Elfo' }]);
		expect(fields('c')).toEqual([{ label: 'Razza', value: 'Elfo' }]);
	});
});

describe('copertina', () => {
	const form = (cover: Record<string, string>) => {
		const f = new FormData();
		f.set('title', 'Waterdeep');
		f.set('visibility', 'players');
		f.set('content', JSON.stringify(doc()));
		for (const [k, v] of Object.entries(cover)) f.set(k, v);
		const r = readPageForm(f, alice, { months: [] } as never);
		if (!r.ok) throw new Error(r.error);
		return r.input.cover;
	};

	it('il modulo accetta solo immagini caricate e colori conosciuti', () => {
		expect(form({ coverImage: 'coverxxxxxxxx', coverColor: '', coverY: '30' })).toEqual({ image: 'coverxxxxxxxx', color: null, y: 30 });
		expect(form({ coverImage: 'pdfxxxxxxxxxx', coverColor: 'sea', coverY: '30' })).toEqual({ image: null, color: 'sea', y: 50 });
		expect(form({ coverImage: '', coverColor: 'arcobaleno', coverY: '' })).toBeNull();
	});

	it('si salva, si cambia e resta quando una modifica non la tocca', () => {
		const pg = createPage({ ...base, title: 'Waterdeep', cover: { image: 'coverxxxxxxxx', color: null, y: 30 } }, alice);
		expect(pageCover(pg)).toEqual({ image: 'coverxxxxxxxx', color: null, y: 30 });
		// Ripristinare una versione non passa la copertina: resta quella che c'è.
		updatePage(pg, { ...base, title: 'Waterdeep' }, alice, false);
		expect(pageCover(getPageBySlug('waterdeep')!)).toEqual({ image: 'coverxxxxxxxx', color: null, y: 30 });
		updatePage(pg, { ...base, title: 'Waterdeep', cover: { image: null, color: 'forest', y: 50 } }, alice, false);
		expect(pageCover(getPageBySlug('waterdeep')!)).toEqual({ image: null, color: 'forest', y: 50 });
		updatePage(pg, { ...base, title: 'Waterdeep', cover: null }, alice, false);
		expect(pageCover(getPageBySlug('waterdeep')!)).toBeNull();
	});

	it("l'immagine di copertina è nella galleria, per chi può leggere la pagina", () => {
		createPage({ ...base, title: 'Waterdeep', cover: { image: 'diaryxxxxxxxx', color: null, y: 50 } }, master);
		createPage({ ...base, visibility: 'master', title: 'Covo', cover: { image: 'gmxxxxxxxx', color: null, y: 50 } }, master);
		expect(galleryImages(alice).find((i) => i.id.startsWith('diary'))!.sources).toEqual([{ kind: 'cover', title: 'Waterdeep', href: '/wiki/waterdeep' }]);
		expect(ids(alice)).not.toContain('gm');
		expect(ids(master)).toContain('gm');
	});
});

describe('galleria', () => {
	beforeEach(() => {
		createPage({ ...base, title: 'Elminster', fields: [pic('coverxxxxxxxx')], content: doc(img('inlinexxxxxxxx', 'Torre di Elminster'), { type: 'secret', content: [img('secretxxxxxxxx')] }) }, master);
		createPage({ ...base, visibility: 'master', title: 'Piano', fields: [pic('inlinexxxxxxxx')], content: doc(img('gmxxxxxxxx')) }, master);
		createPage({ ...base, visibility: 'personal', title: 'Diario', content: doc(img('diaryxxxxxxxx')) }, alice);
		createPage({ ...base, kind: 'map', title: 'Faerûn' }, master, (p) => createMap(p, { parentId: null, scale: null, unit: '' }, { id: 'mapxxxxxxxx', width: 40, height: 30 }, 1));
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
		expect(galleryImages(alice).find((i) => i.id.startsWith('map'))!.sources).toEqual([{ kind: 'map', title: 'Faerûn', href: '/wiki/faerun' }]);
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
		const shape = (list: TreeNode[]): unknown[] => list.map((n) => (n.type === 'folder' ? [n.name, shape(n.items)] : n.type === 'page' ? n.title : '---'));
		expect(shape(pageTree(alice).items)).toEqual([['Luoghi', ['Waterdeep']], 'Bartolo']);
		expect(shape(pageTree(master).items)).toEqual([['Luoghi', ['Covo', 'Waterdeep']], ['Segreti', []], 'Bartolo']);
	});
});
