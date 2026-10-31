import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { allowedVisibilities, canEdit, canManage, isMaster } from '#lib/access.ts';
import { deletePage, getPageBySlug, pageCover, pageMeta, updatePage } from '#lib/server/pages.ts';
import { readPageForm } from '#lib/server/pageForm.ts';
import { mapFormValues, readMapForm } from '#lib/server/mapForm.ts';
import { getMapOfPage, listMaps, updateMap } from '#lib/server/maps.ts';
import { getTimeline, setTimelineMode } from '#lib/server/timeline.ts';
import { saveImage } from '#lib/server/files.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { getCalendar, isHomePage } from '#lib/server/settings.ts';
import { setHomePage } from '#lib/server/templates.ts';
import { getFile } from '#lib/server/files.ts';
import { canCreateKind, TIMELINE_MODES, type TimelineMode } from '#lib/pageKinds.ts';

function editable(slug: string, u: App.Locals['user']) {
	const page = getPageBySlug(slug);
	if (!page || !canEdit(page, u)) error(404, 'Not found');
	return page;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	const page = editable(params.slug, locals.user);
	const map = page.kind === 'map' ? getMapOfPage(page.id) : undefined;
	return {
		page: {
			slug: page.slug,
			title: page.title,
			content: page.content,
			visibility: page.visibility,
			playersCanEdit: page.playersCanEdit,
			categoryId: page.categoryId,
			updatedAt: page.updatedAt,
			tags: pageMeta(page).tags.map((t) => t.name).join(', '),
			// Un riquadro immagine il cui file non c'è più si toglie anche qui.
			fields: (page.fields ?? []).filter((f) => !f.image || getFile(f.image)),
			template: page.template,
			session: page.session ?? null,
			icon: page.icon,
			cover: pageCover(page),
			kind: page.kind
		},
		// Le impostazioni proprie della mappa (le cambia il Master) e della cronologia.
		extra: {
			map: map && isMaster(locals.user) ? mapFormValues(map) : null,
			mode: getTimeline(page.id)?.mode ?? 'world'
		},
		parents: map ? listMaps(locals.user).filter((m) => m.id !== map.id).map(({ id, title }) => ({ id, title })) : [],
		months: getCalendar().months,
		categories: categoryTree(locals.user).flat.map(({ id, label }) => ({ id, label })),
		visibilities: allowedVisibilities(locals.user),
		canManage: canManage(page, locals.user),
		canSecret: isMaster(locals.user),
		canTemplate: canCreateKind('template', locals.user),
		canHome: isMaster(locals.user) && page.kind === 'page',
		isHome: isHomePage(page.id),
		knownTags: listTags(locals.user, true).map((t) => t.name)
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const u = locals.user;
		if (!u) return fail(401, { error: 'errors.forbidden', values: null, extra: null });
		const page = editable(params.slug, u);
		const f = await request.formData();
		const r = readPageForm(f, u, getCalendar());
		const map = page.kind === 'map' && isMaster(u) ? getMapOfPage(page.id) : undefined;
		const mode: TimelineMode = TIMELINE_MODES.includes(f.get('mode') as TimelineMode) ? (f.get('mode') as TimelineMode) : 'world';
		const extra = { map: map ? readMapForm(f, map.width, map.id).values : null, mode };
		if (!r.ok) return fail(400, { error: r.error, values: r.values, extra });
		// Solo chi può fare template trasforma una pagina in template (e viceversa).
		if (r.input.kind !== page.kind && !canCreateKind('template', u)) r.input.kind = page.kind;
		// La home: la sceglie il Master tra le pagine normali, e deve poterla vedere chi apre il sito. Una volta home, resta una pagina.
		if (isHomePage(page.id)) r.input.kind = 'page';
		const home = isHomePage(page.id) || (f.get('home') === 'on' && isMaster(u) && page.kind === 'page' && r.input.kind === 'page');
		if (home && r.input.visibility !== 'public' && r.input.visibility !== 'players') return fail(400, { error: 'errors.homeVisibility', values: r.values, extra });
		// Qualcun altro ha salvato nel frattempo: non sovrascriviamo il suo lavoro.
		if (Number(f.get('updatedAt')) !== page.updatedAt) {
			return fail(409, { error: 'errors.conflict', values: { ...r.input, tags: r.input.tags.join(', '), slug: '', template: r.input.template ?? null, kind: page.kind }, extra });
		}

		// Mappa: immagine nuova (facoltativa), mappa che la contiene, scala.
		let after: (() => void) | undefined;
		if (map) {
			const image = f.get('image');
			let file: { id: string; width: number; height: number } | undefined;
			if (image instanceof File && image.size > 0) {
				const saved = saveImage(Buffer.from(await image.arrayBuffer()), image.name, u.id);
				if (!saved.ok) return fail(400, { error: saved.error, values: r.values, extra });
				file = saved.file;
			}
			const m = readMapForm(f, file?.width ?? map.width, map.id);
			if (m.error) return fail(400, { error: m.error, values: r.values, extra });
			after = () => updateMap(map.id, m.input, file);
		} else if (page.kind === 'timeline' && isMaster(u) && f.has('mode')) after = () => setTimelineMode(page.id, mode);
		else if (home) {
			r.input.categoryId = null;
			after = () => setHomePage(page.id);
		}

		updatePage(page, r.input, u, canManage(page, u), after);
		redirect(303, `/wiki/${page.slug}`);
	},
	delete: async ({ params, request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', values: null, extra: null });
		const page = editable(params.slug, locals.user);
		if (!canManage(page, locals.user) || isHomePage(page.id)) return fail(403, { error: 'errors.forbidden', values: null, extra: null });
		if ((await request.formData()).get('confirm') !== 'on') return fail(400, { error: 'errors.confirm', values: null, extra: null });
		deletePage(page.id);
		redirect(303, '/wiki?deleted=1');
	}
};
