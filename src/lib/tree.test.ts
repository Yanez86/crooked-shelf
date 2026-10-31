import { describe, expect, it } from 'vitest';
import { buildTree, keyPlace, placeAt, treePaths, treeTemplates, withoutTemplates, type TreeNode } from './tree.ts';

const cats = [
	{ id: 1, name: 'Luoghi', slug: 'luoghi', parentId: null },
	{ id: 2, name: 'Città', slug: 'citta', parentId: 1 },
	{ id: 3, name: 'Fazioni', slug: 'fazioni', parentId: null },
	{ id: 4, name: 'Archivio', slug: 'archivio', parentId: null }
];
const pages = [
	{ id: 1, slug: 'waterdeep', title: 'Waterdeep', categoryId: 2 },
	{ id: 2, slug: 'baldur', title: "Baldur's Gate", categoryId: 2 },
	{ id: 3, slug: 'costa', title: 'Costa della Spada', categoryId: 1 },
	{ id: 4, slug: 'zhentarim', title: 'Zhentarim', categoryId: 3 },
	{ id: 5, slug: 'bartolo', title: 'bartolo Pancia', categoryId: null },
	{ id: 6, slug: 'arpa', title: 'Arpisti', categoryId: null }
];

// L'albero in breve: le voci in ordine, ciò che contengono in una lista subito dopo.
const shape = (list: TreeNode[]): unknown[] =>
	list.flatMap((n) => (n.type === 'divider' ? ['---'] : [n.type === 'folder' ? n.name : n.title, ...(n.items.length ? [shape(n.items)] : [])]));

describe('albero delle pagine', () => {
	it('cartelle e sottocartelle in ordine, pagine senza categoria alla radice', () => {
		expect(shape(buildTree(cats, pages, false).items)).toEqual([
			'Fazioni',
			['Zhentarim'],
			'Luoghi',
			['Città', ["Baldur's Gate", 'Waterdeep'], 'Costa della Spada'],
			'Arpisti',
			'bartolo Pancia'
		]);
	});

	it('le cartelle vuote restano solo per chi gestisce le categorie', () => {
		expect(shape(buildTree(cats, pages, true).items).filter((x) => typeof x === 'string').slice(0, 3)).toEqual(['Archivio', 'Fazioni', 'Luoghi']);
		// Città non ha pagine visibili, ma Luoghi sì: resta Luoghi, sparisce Città.
		const few = buildTree(cats, [{ id: 1, slug: 'costa', title: 'Costa', categoryId: 1 }], false);
		expect(shape(few.items)).toEqual(['Luoghi', ['Costa']]);
	});

	it("i template escono dall'albero e hanno il loro elenco", () => {
		const folders = [
			{ id: 1, name: 'Template', slug: 'template', parentId: null },
			{ id: 2, name: 'Luoghi', slug: 'luoghi', parentId: null },
			{ id: 3, name: 'Vuota', slug: 'vuota', parentId: null }
		];
		const rows = [
			{ id: 1, slug: 'png', title: 'PNG', categoryId: 1, kind: 'template' as const },
			{ id: 2, slug: 'luogo', title: 'Luogo', categoryId: 2, kind: 'template' as const },
			{ id: 3, slug: 'porto', title: 'Porto', categoryId: 2, parentPageId: 2 }
		];
		const { items } = buildTree(folders, rows, true);
		// La cartella che aveva solo template sparisce, quella già vuota resta, e Porto risale dal template che lo conteneva.
		expect(shape(withoutTemplates(items))).toEqual(['Luoghi', ['Porto'], 'Vuota']);
		expect(treeTemplates(items).map((p) => p.title)).toEqual(['Luogo', 'PNG']);
	});

	it('una categoria dentro sé stessa non fa sparire le pagine', () => {
		const loop = [
			{ id: 1, name: 'A', slug: 'a', parentId: 2 },
			{ id: 2, name: 'B', slug: 'b', parentId: 1 }
		];
		const tree = buildTree(loop, [{ id: 1, slug: 'x', title: 'X', categoryId: 1 }], true);
		expect(shape(tree.items)).toEqual(['A', ['X'], 'B']);
	});

	it('sa quali cartelle aprire per arrivare a una pagina', () => {
		const paths = treePaths(buildTree(cats, pages, false));
		expect(paths.pages.get('waterdeep')).toEqual(['folder-1', 'folder-2']);
		expect(paths.pages.get('bartolo')).toEqual([]);
		expect(paths.folders.get('citta')).toEqual(['folder-1', 'folder-2']);
	});

	it("l'ordine scelto vale per cartelle, pagine e divisori insieme; il resto va in fondo", () => {
		const list = buildTree(
			[{ id: 1, name: 'Luoghi', slug: 'l', parentId: null, sort: 3 }, { id: 2, name: 'Nuova', slug: 'n', parentId: null }],
			[{ id: 1, slug: 'a', title: 'Alba', categoryId: null, sort: 1 }, { id: 2, slug: 'b', title: 'Bosco', categoryId: null }],
			true,
			[{ id: 1, categoryId: null, parentPageId: null, sort: 2 }]
		);
		expect(shape(list.items)).toEqual(['Alba', '---', 'Luoghi', 'Nuova', 'Bosco']);
	});

	it('pagine e cartelle dentro una pagina; se la pagina non si vede risalgono alla cartella', () => {
		const folders = [{ id: 1, name: 'Luoghi', slug: 'l', parentId: null }, { id: 2, name: 'Mappe', slug: 'm', parentId: null, parentPageId: 1 }];
		const rows = [
			{ id: 1, slug: 'citta', title: 'Città', categoryId: 1 },
			{ id: 2, slug: 'porto', title: 'Porto', categoryId: 1, parentPageId: 1 }
		];
		expect(shape(buildTree(folders, rows, true).items)).toEqual(['Luoghi', ['Città', ['Mappe', 'Porto']]]);
		expect(shape(buildTree(folders, rows.slice(1), true).items)).toEqual(['Luoghi', ['Porto'], 'Mappe']);
	});

	it('una pagina e una cartella una dentro l\'altra restano nell\'albero', () => {
		const tree = buildTree([{ id: 1, name: 'A', slug: 'a', parentId: null, parentPageId: 1 }], [{ id: 1, slug: 'p', title: 'P', categoryId: 1 }], true);
		expect(shape(tree.items)).toEqual(['A', 'P']);
	});

	it('i divisori che non separano niente non si vedono, se non a chi gestisce', () => {
		const dividers = [
			{ id: 1, categoryId: null, parentPageId: null, sort: 1 },
			{ id: 2, categoryId: null, parentPageId: null, sort: 3 },
			{ id: 3, categoryId: null, parentPageId: null, sort: 4 }
		];
		const one = [{ id: 1, slug: 'a', title: 'A', categoryId: null, sort: 2 }];
		expect(shape(buildTree([], one, false, dividers).items)).toEqual(['A']);
		expect(shape(buildTree([], one, true, dividers).items)).toEqual(['---', 'A', '---', '---']);
	});

	describe('spostamenti', () => {
		const tree = buildTree(cats, pages, true);

		it('prima, dopo e dentro una riga', () => {
			expect(placeAt(tree, 'page-5', 'folder-3', 'before', false)).toEqual({ parent: null, before: 'folder-3' });
			expect(placeAt(tree, 'page-5', 'folder-3', 'after', false)).toEqual({ parent: null, before: 'folder-1' });
			expect(placeAt(tree, 'page-5', 'page-6', 'inside', false)).toEqual({ parent: 'page-6', before: null });
			// Sotto una cartella aperta si entra, in cima.
			expect(placeAt(tree, 'page-5', 'folder-3', 'after', true)).toEqual({ parent: 'folder-3', before: 'page-4' });
		});

		it('non in sé stessa, né in ciò che contiene', () => {
			expect(placeAt(tree, 'folder-1', 'folder-1', 'inside', false)).toBeNull();
			expect(placeAt(tree, 'folder-1', 'folder-2', 'inside', false)).toBeNull();
			expect(placeAt(tree, 'folder-1', 'page-1', 'before', false)).toBeNull();
		});

		it('un divisorio non contiene niente', () => {
			const withLine = buildTree(cats, pages, true, [{ id: 1, categoryId: null, parentPageId: null, sort: null }]);
			expect(placeAt(withLine, 'page-5', 'divider-1', 'inside', false)).toBeNull();
		});

		it('da tastiera', () => {
			expect(keyPlace(tree, 'page-6', 'up')).toEqual({ parent: null, before: 'folder-1' });
			expect(keyPlace(tree, 'page-6', 'down')).toEqual({ parent: null, before: null });
			expect(keyPlace(tree, 'page-5', 'in')).toEqual({ parent: 'page-6', before: null });
			expect(keyPlace(tree, 'page-1', 'out')).toEqual({ parent: 'folder-1', before: 'page-3' });
			expect(keyPlace(tree, 'folder-4', 'up')).toBeNull();
			expect(keyPlace(tree, 'folder-4', 'out')).toBeNull();
		});
	});
});
