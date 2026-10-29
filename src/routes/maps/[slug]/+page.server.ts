import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import {
	canSeeMap,
	deleteLayer,
	deletePin,
	getMap,
	getMapBySlug,
	getPin,
	layersOf,
	listMaps,
	pinsOf,
	PIN_COLORS,
	PIN_ICONS,
	saveLayer,
	savePin,
	type PinInput
} from '#lib/server/maps.ts';
import { listPages, resolverFor } from '#lib/server/pages.ts';
import { renderInline } from '#lib/content/render.ts';
import { inlineLinks } from '#lib/content/extract.ts';
import { contentLabels } from '#lib/server/pageForm.ts';
import { str } from '#lib/server/forms.ts';
import { slugify } from '#lib/slug.ts';
import { hasRule } from '#lib/server/rules/index.ts';
import { getDb, schema } from '#lib/server/db/index.ts';
import { eq } from 'drizzle-orm';

function visibleMap(slug: string, u: App.Locals['user']) {
	const m = getMapBySlug(slug);
	if (!m || !canSeeMap(m, u)) error(404, 'Not found');
	return m;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const map = visibleMap(params.slug, locals.user);
	const u = locals.user;
	const pins = pinsOf(map.id, u);
	const slugs = [...pins.flatMap((p) => inlineLinks(p.description)), ...pins.map((p) => p.pageSlug).filter((s): s is string => !!s)];
	const resolve = resolverFor(slugs, u);
	const labels = contentLabels(locals.locale);

	// Percorso delle mappe che contengono questa.
	const path: { slug: string; title: string }[] = [];
	const seen = new Set([map.id]);
	for (let p = map.parentId ? getMap(map.parentId) : undefined; p && !seen.has(p.id); p = p.parentId ? getMap(p.parentId) : undefined) {
		seen.add(p.id);
		if (canSeeMap(p, u)) path.unshift({ slug: p.slug, title: p.title });
	}
	const all = listMaps(u);
	const master = isMaster(u);
	const pageTitleOf = (slug: string) =>
		getDb().select({ title: schema.pages.title }).from(schema.pages).where(eq(schema.pages.slug, slug)).get()?.title ?? '';

	return {
		map: {
			id: map.id,
			slug: map.slug,
			title: map.title,
			description: map.description,
			fileId: map.fileId,
			width: map.width,
			height: map.height,
			visibility: map.visibility,
			scale: map.scale,
			unit: map.unit
		},
		path,
		children: all.filter((m) => m.parentId === map.id).map(({ slug, title }) => ({ slug, title })),
		layers: layersOf(map.id, u).map(({ id, name, visibility }) => ({ id, name, visibility })),
		pins: pins.map((p) => {
			const page = p.pageSlug ? resolve(p.pageSlug) : undefined;
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
				page: p.pageSlug ? (page?.visible ? { slug: p.pageSlug, title: page.title } : page ? null : { slug: p.pageSlug, title: '', missing: true }) : null,
				pageTitle: master && p.pageSlug ? pageTitleOf(p.pageSlug) || p.pageSlug : '',
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
					pageTitles: listPages(u, { limit: 1000, sort: 'title' }).rows.map((r) => r.title)
				}
			: null
	};
};

function readPin(f: FormData, map: { id: number; width: number; height: number }): { input: PinInput } | { error: string } {
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
			pageSlug: pageTitle ? slugify(pageTitle) : null,
			targetMapId: targetOk ? target : null,
			layerId: layerOk ? layer : null,
			visibility: str(f, 'visibility') === 'master' ? 'master' : 'players'
		}
	};
}

function masterMap(slug: string, u: App.Locals['user']) {
	if (!isMaster(u)) error(404, 'Not found');
	return visibleMap(slug, u);
}

export const actions: Actions = {
	pin: async ({ params, request, locals }) => {
		const map = masterMap(params.slug, locals.user);
		const f = await request.formData();
		const r = readPin(f, map);
		if ('error' in r) return fail(400, { error: r.error });
		const id = Number(f.get('id'));
		const existing = id ? getPin(id) : undefined;
		if (id && existing?.mapId !== map.id) return fail(404, { error: 'errors.generic' });
		savePin(map.id, r.input, existing?.id);
		return { ok: existing ? 'maps.pinSaved' : 'maps.pinAdded' };
	},
	deletePin: async ({ params, request, locals }) => {
		const map = masterMap(params.slug, locals.user);
		deletePin(map.id, Number((await request.formData()).get('id')));
		return { ok: 'maps.pinDeleted' };
	},
	layer: async ({ params, request, locals }) => {
		const map = masterMap(params.slug, locals.user);
		const f = await request.formData();
		const name = str(f, 'name', 60);
		if (!name) return fail(400, { error: 'errors.nameRequired' });
		const id = Number(f.get('id'));
		saveLayer(map.id, name, str(f, 'visibility') === 'master' ? 'master' : 'players', id > 0 ? id : undefined);
		return { ok: 'common.saved' };
	},
	deleteLayer: async ({ params, request, locals }) => {
		const map = masterMap(params.slug, locals.user);
		deleteLayer(map.id, Number((await request.formData()).get('id')));
		return { ok: 'maps.layerDeleted' };
	}
};
