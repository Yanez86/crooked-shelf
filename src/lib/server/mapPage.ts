import { error, fail } from '@sveltejs/kit';
import { isMaster, type Viewer } from '../access.ts';
import {
	deleteLayer,
	deletePin,
	getMap,
	getMapOfPage,
	getPin,
	layersOf,
	listMaps,
	mapPath,
	pinsOf,
	PIN_COLORS,
	PIN_ICONS,
	saveLayer,
	savePin,
	type MapRow,
	type PinInput
} from './maps.ts';
import { findPageChoice, pageChoices, resolverFor, type PageRow } from './pages.ts';
import { renderInline } from '../content/render.ts';
import { inlineLinks } from '../content/extract.ts';
import { contentLabels } from './pageForm.ts';
import { str } from './forms.ts';
import { slugify } from '../slug.ts';
import { hasRule } from './rules/index.ts';

/** Quello che serve per mostrare la mappa di una pagina «mappa»: pin, livelli, mappe intorno. */
export function mapView(page: PageRow, u: Viewer | null, locale: string) {
	const map = getMapOfPage(page.id);
	if (!map) return null;
	const pins = pinsOf(map.id, u);
	const slugs = [...pins.flatMap((p) => inlineLinks(p.description)), ...pins.map((p) => p.pageSlug).filter((s): s is string => !!s)];
	const resolve = resolverFor(slugs, u);
	const labels = contentLabels(locale);
	const all = listMaps(u);
	const master = isMaster(u);
	// Nel modulo del pin la pagina si sceglie per nome; due pagine omonime hanno anche l'indirizzo.
	const choices = master ? pageChoices(u) : [];
	const choiceOf = new Map(choices.map((c) => [c.slug, c.label]));

	return {
		map: { id: map.id, fileId: map.fileId, width: map.width, height: map.height, scale: map.scale, unit: map.unit },
		path: mapPath(map, u),
		children: all.filter((m) => m.parentId === map.id).map(({ slug, title }) => ({ slug, title })),
		layers: layersOf(map.id, u).map(({ id, name, visibility }) => ({ id, name, visibility })),
		pins: pins.map((p) => {
			const linked = p.pageSlug ? resolve(p.pageSlug) : undefined;
			return {
				id: p.id,
				x: p.x,
				y: p.y,
				label: p.label,
				description: p.description,
				html: renderInline(p.description, { resolve, labels, hasRule }),
				icon: p.icon,
				color: p.color,
				layerId: p.layerId,
				visibility: p.visibility,
				pageSlug: p.pageSlug,
				// La pagina collegata: visibile, da creare, oppure nascosta (niente collegamento).
				page: p.pageSlug ? (linked?.visible ? { slug: p.pageSlug, title: linked.title } : linked ? null : { slug: p.pageSlug, title: '', missing: true }) : null,
				pageTitle: master && p.pageSlug ? (choiceOf.get(p.pageSlug) ?? p.pageSlug) : '',
				targetMapId: p.targetMapId,
				target: p.target
			};
		}),
		canEdit: master,
		editData: master
			? {
					icons: [...PIN_ICONS],
					colors: [...PIN_COLORS],
					maps: all.filter((m) => m.id !== map.id).map(({ id, title }) => ({ id, title })),
					pageTitles: choices.slice(0, 1000).map((c) => c.label)
				}
			: null
	};
}

function readPin(f: FormData, map: MapRow, u: Viewer | null): { input: PinInput } | { error: string } {
	const x = Number(f.get('x'));
	const y = Number(f.get('y'));
	const label = str(f, 'label', 120);
	if (!label) return { error: 'errors.nameRequired' };
	if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > map.width || y > map.height) return { error: 'maps.errPosition' };
	const icon = str(f, 'icon');
	const color = str(f, 'color');
	const layer = Number(f.get('layerId'));
	const target = Number(f.get('targetMapId'));
	const pageTitle = str(f, 'page', 200);
	const layerOk = Number.isInteger(layer) && layer > 0 && layersOf(map.id, { id: 0, role: 'master' }).some((l) => l.id === layer);
	const targetOk = Number.isInteger(target) && target > 0 && target !== map.id && !!getMap(target);
	return {
		input: {
			x,
			y,
			label,
			description: str(f, 'description', 1000),
			icon: (PIN_ICONS as readonly string[]).includes(icon) ? icon : 'pin',
			color: (PIN_COLORS as readonly string[]).includes(color) ? color : 'red',
			// Una pagina che non c'è ancora resta un collegamento da creare con quel titolo.
			pageSlug: pageTitle ? (findPageChoice(pageTitle, u)?.slug ?? slugify(pageTitle)) : null,
			targetMapId: targetOk ? target : null,
			layerId: layerOk ? layer : null,
			visibility: str(f, 'visibility') === 'master' ? 'master' : 'players'
		}
	};
}

/** Pin e livelli li cambia solo il Master, sulle mappe che vede. */
function masterMap(page: PageRow | undefined, u: Viewer | null): MapRow {
	const map = page?.kind === 'map' && isMaster(u) ? getMapOfPage(page.id) : undefined;
	if (!map) error(404, 'Not found');
	return map;
}

/** Le azioni della pagina di una mappa (moduli dei pin e dei livelli). */
export const mapActions = {
	pin: (page: PageRow | undefined, u: Viewer | null, f: FormData) => {
		const map = masterMap(page, u);
		const r = readPin(f, map, u);
		if ('error' in r) return fail(400, { error: r.error });
		const id = Number(f.get('id'));
		const existing = id ? getPin(id) : undefined;
		if (id && existing?.mapId !== map.id) return fail(404, { error: 'errors.generic' });
		savePin(map.id, r.input, existing?.id);
		return { ok: existing ? 'maps.pinSaved' : 'maps.pinAdded' };
	},
	deletePin: (page: PageRow | undefined, u: Viewer | null, f: FormData) => {
		const map = masterMap(page, u);
		deletePin(map.id, Number(f.get('id')));
		return { ok: 'maps.pinDeleted' };
	},
	layer: (page: PageRow | undefined, u: Viewer | null, f: FormData) => {
		const map = masterMap(page, u);
		const name = str(f, 'name', 60);
		if (!name) return fail(400, { error: 'errors.nameRequired' });
		const id = Number(f.get('id'));
		saveLayer(map.id, name, str(f, 'visibility') === 'master' ? 'master' : 'players', id > 0 ? id : undefined);
		return { ok: 'common.saved' };
	},
	deleteLayer: (page: PageRow | undefined, u: Viewer | null, f: FormData) => {
		const map = masterMap(page, u);
		deleteLayer(map.id, Number(f.get('id')));
		return { ok: 'maps.layerDeleted' };
	}
};
