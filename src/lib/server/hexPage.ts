import { error, fail } from '@sveltejs/kit';
import { canView, isMaster, type Viewer } from '../access.ts';
import {
	builtinTileset,
	cleanCells,
	createHexMap,
	deleteFeature,
	getCell,
	getFeature,
	getHexMapOfPage,
	hexTilesets,
	inRange,
	moveParty,
	paintCells,
	removeCells,
	revealAround,
	saveFeature,
	setCellNote,
	setCellsState,
	terrainLook,
	tilesetOf,
	validTileset,
	visibleCells,
	visibleFeatures,
	visibleParty,
	type HexFeatureInput,
	type HexMapInput,
	type HexMapRow
} from './hexmaps.ts';
import { PIN_ICONS } from './maps.ts';
import { findPageChoice, pageChoices, resolverFor, type PageRow } from './pages.ts';
import { renderInline } from '../content/render.ts';
import { inlineLinks } from '../content/extract.ts';
import { contentLabels } from './pageForm.ts';
import { str } from './forms.ts';
import { slugify } from '../slug.ts';
import { hasRule } from './rules/index.ts';
import { hexKey, isHexOrientation, isHexState, neighbors, type Axial } from '../hex.ts';
import { BUILTIN_TILESET, TERRAIN_ID } from '../hexTiles.ts';

export const HEX_DEFAULTS: HexMapInput = { orientation: 'flat', scale: null, unit: '', tileset: BUILTIN_TILESET };

/** La mappa di una pagina «mappa a esagoni»; se manca (es. pagina da un pacchetto vecchio) nasce con un esagono. */
export function ensureHexMap(page: PageRow): HexMapRow {
	return getHexMapOfPage(page.id) ?? createHexMap(page.id, HEX_DEFAULTS);
}

/** Le impostazioni dal modulo della pagina: orientamento, scala («un esagono è largo…») e set di tasselli. */
export function readHexForm(f: FormData): { input: HexMapInput; renumber: boolean; values: { orientation: string; across: string; unit: string; tileset: string } } {
	const orientation = isHexOrientation(f.get('orientation')) ? (f.get('orientation') as HexMapInput['orientation']) : 'flat';
	const across = Number(String(f.get('across') ?? '').replace(',', '.'));
	const tileset = str(f, 'tileset', 100);
	const input: HexMapInput = {
		orientation,
		scale: across > 0 && Number.isFinite(across) ? Math.round(across * 1000) / 1000 : null,
		unit: str(f, 'unit', 20),
		tileset: validTileset(tileset) ? tileset : BUILTIN_TILESET
	};
	return { input, renumber: f.get('renumber') === 'on', values: { orientation, across: String(f.get('across') ?? ''), unit: input.unit, tileset: input.tileset } };
}

/** Le impostazioni come le mostra il modulo. */
export const hexFormValues = (m: Pick<HexMapRow, 'orientation' | 'scale' | 'unit' | 'tileset'>) => ({
	orientation: m.orientation,
	across: m.scale ? String(m.scale) : '',
	unit: m.unit,
	tileset: m.tileset
});

/** I set tra cui scegliere nel modulo, con un'anteprima dei primi terreni. */
export const tilesetChoices = (locale: string) =>
	hexTilesets(locale).map((t) => ({ id: t.id, name: t.name, source: t.source, license: t.license, terrains: t.terrains.slice(0, 6) }));

/** Quello che serve per mostrare la mappa a esagoni a chi guarda: solo quello che può sapere. */
export function hexView(page: PageRow, u: Viewer | null, locale: string) {
	const map = ensureHexMap(page);
	const master = isMaster(u);
	const builtin = builtinTileset(locale);
	const { set, missing } = tilesetOf(map, locale);
	const cells = visibleCells(map.id, u);
	const features = visibleFeatures(map.id, u);
	const slugs = [...features.flatMap((f) => inlineLinks(f.description)), ...features.map((f) => f.pageSlug).filter((s): s is string => !!s)];
	const resolve = resolverFor(slugs, u);
	const labels = contentLabels(locale);
	// I terreni della tavolozza (il set scelto) e quelli che ci sono sulla mappa, anche se il set non li ha.
	const terrains: Record<string, ReturnType<typeof terrainLook>> = {};
	for (const id of [...set.terrains.map((t) => t.id), ...cells.map((c) => c.terrain)]) terrains[id] ??= terrainLook(id, set, builtin);
	const choices = master ? pageChoices(u) : [];
	const choiceOf = new Map(choices.map((c) => [c.slug, c.label]));

	return {
		map: { id: map.id, orientation: map.orientation, scale: map.scale, unit: map.unit, updatedAt: map.updatedAt },
		// Da dove si contano i numeri. Null (solo per il Master) = automatica, finché i giocatori non scoprono niente;
		// agli altri arriva solo quella ferma: quella automatica direbbe fin dove arriva la mappa.
		numbering: map.originCol !== null && map.originRow !== null ? { col: map.originCol, row: map.originRow } : master ? null : { col: 0, row: 0 },
		tileset: { id: set.id, name: set.name, missing: master && missing ? map.tileset : null },
		palette: master ? set.terrains.map((t) => t.id) : [],
		terrains,
		cells: cells.map((c) => ({ q: c.q, r: c.r, terrain: c.terrain, state: c.state, revealedAt: c.revealedAt, note: master ? c.note : '' })),
		features: features.map((f) => {
			const linked = f.pageSlug ? resolve(f.pageSlug) : undefined;
			return {
				id: f.id,
				q: f.q,
				r: f.r,
				icon: f.icon,
				name: f.name,
				description: master ? f.description : '',
				html: renderInline(f.description, { resolve, labels, hasRule }),
				visibility: f.visibility,
				// La pagina collegata: visibile, da creare, oppure nascosta (niente collegamento).
				page: f.pageSlug ? (linked?.visible ? { slug: f.pageSlug, title: linked.title } : linked ? null : { slug: f.pageSlug, title: '', missing: true }) : null,
				pageTitle: master && f.pageSlug ? (choiceOf.get(f.pageSlug) ?? f.pageSlug) : ''
			};
		}),
		party: visibleParty(map, u),
		canEdit: master,
		editData: master ? { icons: [...PIN_ICONS], pageTitles: choices.slice(0, 1000).map((c) => c.label) } : null
	};
}

/** La mappa della pagina, se chi scrive è il Master e la vede. */
export function masterHexMap(page: PageRow | undefined, u: Viewer | null): HexMapRow {
	const map = page?.kind === 'hexmap' && isMaster(u) && canView(page, u) ? getHexMapOfPage(page.id) : undefined;
	if (!map) error(404, 'Not found');
	return map;
}

const at = (f: FormData): Axial => ({ q: Number(f.get('q')), r: Number(f.get('r')) });

function readFeature(f: FormData, map: HexMapRow, u: Viewer | null): { input: HexFeatureInput } | { error: string } {
	const h = at(f);
	const name = str(f, 'name', 120);
	if (!name) return { error: 'errors.nameRequired' };
	if (!inRange(h) || !getCell(map.id, h)) return { error: 'hex.errCell' };
	const icon = str(f, 'icon');
	const pageTitle = str(f, 'page', 200);
	return {
		input: {
			q: h.q,
			r: h.r,
			name,
			icon: (PIN_ICONS as readonly string[]).includes(icon) ? icon : 'pin',
			description: str(f, 'description', 1000),
			// Una pagina che non c'è ancora resta un collegamento da creare con quel titolo.
			pageSlug: pageTitle ? (findPageChoice(pageTitle, u)?.slug ?? slugify(pageTitle)) : null,
			visibility: str(f, 'visibility') === 'master' ? 'master' : 'players'
		}
	};
}

/** Le azioni della pagina di una mappa a esagoni: elementi e note (gli esagoni cambiano dall'API, senza ricaricare). */
export const hexActions = {
	hexFeature: (page: PageRow | undefined, u: Viewer | null, f: FormData) => {
		const map = masterHexMap(page, u);
		const r = readFeature(f, map, u);
		if ('error' in r) return fail(400, { error: r.error });
		const id = Number(f.get('id'));
		const existing = id ? getFeature(map.id, id) : undefined;
		if (id && !existing) return fail(404, { error: 'errors.generic' });
		saveFeature(map.id, r.input, existing?.id);
		return { ok: existing ? 'hex.featureSaved' : 'hex.featureAdded' };
	},
	deleteHexFeature: (page: PageRow | undefined, u: Viewer | null, f: FormData) => {
		const map = masterHexMap(page, u);
		deleteFeature(map.id, Number(f.get('id')));
		return { ok: 'hex.featureDeleted' };
	},
	hexNote: (page: PageRow | undefined, u: Viewer | null, f: FormData) => {
		const map = masterHexMap(page, u);
		const h = at(f);
		if (!inRange(h) || !getCell(map.id, h)) return fail(400, { error: 'hex.errCell' });
		setCellNote(map.id, h, str(f, 'note', 2000));
		return { ok: 'hex.noteSaved' };
	}
};

/**
 * Una modifica agli esagoni mandata dalla mappa (dipingere, togliere, scoprire, spostare il gruppo). Restituisce gli
 * esagoni toccati come sono adesso, così il browser si rimette in pari, oppure l'errore da mostrare.
 */
export function applyHexOp(map: HexMapRow, body: Record<string, unknown>) {
	const cells = cleanCells(body.cells);
	let touched: Axial[] = cells;
	let kept: Axial[] = [];
	switch (body.op) {
		case 'paint': {
			const terrain = String(body.terrain ?? '');
			if (!TERRAIN_ID.test(terrain)) return { error: 'errors.generic' };
			if (paintCells(map.id, cells, terrain) === null) return { error: 'hex.errTooMany' };
			break;
		}
		case 'erase':
			kept = removeCells(map.id, cells);
			break;
		case 'state':
			if (!isHexState(body.state)) return { error: 'errors.generic' };
			setCellsState(map.id, cells, body.state);
			break;
		case 'party': {
			const raw = body.at as Axial | null | undefined;
			const to = raw ? { q: Number(raw.q), r: Number(raw.r) } : null;
			if (to && !inRange(to)) return { error: 'hex.errCell' };
			if (!moveParty(map.id, to, body.reveal === true)) return { error: 'hex.errCell' };
			touched = to ? [to, ...neighbors(to)] : [];
			break;
		}
		case 'reveal': {
			if (map.partyQ === null || map.partyR === null) return { error: 'hex.errNoParty' };
			const p = { q: map.partyQ, r: map.partyR };
			revealAround(map.id, p);
			touched = [p, ...neighbors(p)];
			break;
		}
		default:
			return { error: 'errors.generic' };
	}
	const want = new Set(touched.map((h) => hexKey(h.q, h.r)));
	const now = getHexMapOfPage(map.pageId)!;
	return {
		numbering: now.originCol !== null && now.originRow !== null ? { col: now.originCol, row: now.originRow } : null,
		// Quelli che non ci sono più tornano senza terreno: il browser li toglie.
		cells: [...want].map((k) => {
			const [q, r] = k.split(',').map(Number);
			const c = getCell(map.id, { q, r });
			return c ? { q, r, terrain: c.terrain, state: c.state, revealedAt: c.revealedAt, note: c.note } : { q, r, terrain: null };
		}),
		kept,
		party: now.partyQ !== null && now.partyR !== null ? { q: now.partyQ, r: now.partyR } : null
	};
}
