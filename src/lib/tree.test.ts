import { describe, expect, it } from 'vitest';
import { buildTree, treePaths } from './tree.ts';

const cats = [
	{ id: 1, name: 'Luoghi', slug: 'luoghi', parentId: null },
	{ id: 2, name: 'Città', slug: 'citta', parentId: 1 },
	{ id: 3, name: 'Fazioni', slug: 'fazioni', parentId: null },
	{ id: 4, name: 'Archivio', slug: 'archivio', parentId: null }
];
const pages = [
	{ slug: 'waterdeep', title: 'Waterdeep', categoryId: 2 },
	{ slug: 'baldur', title: "Baldur's Gate", categoryId: 2 },
	{ slug: 'costa', title: 'Costa della Spada', categoryId: 1 },
	{ slug: 'zhentarim', title: 'Zhentarim', categoryId: 3 },
	{ slug: 'bartolo', title: 'bartolo Pancia', categoryId: null },
	{ slug: 'arpa', title: 'Arpisti', categoryId: null }
];

describe('albero delle pagine', () => {
	it('cartelle e sottocartelle in ordine, pagine senza categoria alla radice', () => {
		const tree = buildTree(cats, pages, false);
		expect(tree.folders.map((f) => f.name)).toEqual(['Fazioni', 'Luoghi']);
		expect(tree.pages.map((p) => p.title)).toEqual(['Arpisti', 'bartolo Pancia']);
		const luoghi = tree.folders[1];
		expect(luoghi.pages.map((p) => p.slug)).toEqual(['costa']);
		expect(luoghi.folders[0].name).toBe('Città');
		expect(luoghi.folders[0].pages.map((p) => p.title)).toEqual(["Baldur's Gate", 'Waterdeep']);
	});

	it('le cartelle vuote restano solo per chi gestisce le categorie', () => {
		expect(buildTree(cats, pages, true).folders.map((f) => f.name)).toEqual(['Archivio', 'Fazioni', 'Luoghi']);
		// Città non ha pagine visibili, ma Luoghi sì: resta Luoghi, sparisce Città.
		const few = buildTree(cats, [{ slug: 'costa', title: 'Costa', categoryId: 1 }], false);
		expect(few.folders.map((f) => [f.name, f.folders.length])).toEqual([['Luoghi', 0]]);
	});

	it('una categoria dentro sé stessa non fa sparire le pagine', () => {
		const loop = [
			{ id: 1, name: 'A', slug: 'a', parentId: 2 },
			{ id: 2, name: 'B', slug: 'b', parentId: 1 }
		];
		const tree = buildTree(loop, [{ slug: 'x', title: 'X', categoryId: 1 }], true);
		expect(tree.folders.map((f) => f.name)).toEqual(['A', 'B']);
		expect(tree.folders[0].pages.map((p) => p.slug)).toEqual(['x']);
	});

	it('sa quali cartelle aprire per arrivare a una pagina', () => {
		const paths = treePaths(buildTree(cats, pages, false));
		expect(paths.pages.get('waterdeep')).toEqual([1, 2]);
		expect(paths.pages.get('bartolo')).toBeUndefined();
		expect(paths.folders.get('citta')).toEqual([1, 2]);
	});
});
