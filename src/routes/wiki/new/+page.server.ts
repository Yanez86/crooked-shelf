import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { allowedVisibilities, canWrite, isMaster } from '#lib/access.ts';
import { createPage, type PageRow } from '#lib/server/pages.ts';
import { readPageForm } from '#lib/server/pageForm.ts';
import { readMapForm } from '#lib/server/mapForm.ts';
import { createMap, listMaps } from '#lib/server/maps.ts';
import { setTimelineMode } from '#lib/server/timeline.ts';
import { createBoard, readColumns } from '#lib/server/boards.ts';
import { createHexMap } from '#lib/server/hexmaps.ts';
import { readHexForm, tilesetChoices } from '#lib/server/hexPage.ts';
import { saveImage } from '#lib/server/files.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { getTemplatePage, listTemplates, templateCopy } from '#lib/server/templates.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { nestTarget } from '#lib/server/sheets.ts';
import { slugify } from '#lib/slug.ts';
import { canCreateKind, isPageKind, TIMELINE_MODES, type PageKind, type TimelineMode } from '#lib/pageKinds.ts';

// Nell'ordine in cui si scelgono, dopo la pagina vuota.
const OTHER_KINDS = ['board', 'timeline', 'template', 'map', 'hexmap'] as const;

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	// Nella vista giocatore non si crea niente (ci si arriva anche dai collegamenti a pagine che non ci sono).
	if (!canWrite(locals.user)) error(403, 'Forbidden');
	const u = locals.user;
	const title = (url.searchParams.get('title') ?? '').slice(0, 200);
	const slug = slugify(url.searchParams.get('slug') ?? '', '');
	const cat = Number(url.searchParams.get('category'));
	const parent = Number(url.searchParams.get('parent'));
	// Una pagina nuova dentro una scheda giocatore (?in=<id>): sta nella sua cartella e parte Personale.
	const inside = nestTarget(url.searchParams.get('in'), u);
	// Da dove si parte: una pagina bianca, la fotocopia di un template, oppure un altro tipo di pagina.
	const want = url.searchParams.get('kind');
	const kind: PageKind | null = isPageKind(want) && want !== 'page' && canCreateKind(want, u) ? want : null;
	const key = url.searchParams.get('template');
	const tpl = !kind && key && key !== 'none' ? getTemplatePage(key, u) : undefined;
	const chosen = !!kind || key === 'none' || !!tpl;
	const today = new Date().toISOString().slice(0, 10);

	return {
		title,
		slug,
		categoryId: inside ? inside.categoryId : Number.isInteger(cat) && cat > 0 ? cat : null,
		inside: inside ? { id: inside.id, slug: inside.slug, title: inside.title } : null,
		chosen,
		kind: kind ?? 'page',
		templates: chosen ? [] : listTemplates(u),
		otherKinds: chosen ? [] : OTHER_KINDS.filter((k) => canCreateKind(k, u)),
		start: tpl ? { ...templateCopy(tpl, u, today), title: tpl.title } : null,
		parents: kind === 'map' ? listMaps(u).map(({ id, title }) => ({ id, title })) : [],
		tilesets: kind === 'hexmap' ? tilesetChoices(locals.locale) : [],
		parentId: Number.isInteger(parent) && parent > 0 ? parent : null,
		today,
		months: getCalendar().months,
		categories: categoryTree(u).flat.map(({ id, label }) => ({ id, label })),
		visibilities: allowedVisibilities(u),
		canSecret: isMaster(u),
		canTemplate: canCreateKind('template', u),
		knownTags: listTags(u, true).map((t) => t.name)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const u = locals.user;
		if (!u) return fail(401, { error: 'errors.forbidden', values: null, extra: null });
		const f = await request.formData();
		const r = readPageForm(f, u, getCalendar());
		const mode: TimelineMode = TIMELINE_MODES.includes(f.get('mode') as TimelineMode) ? (f.get('mode') as TimelineMode) : 'world';
		const probe = readMapForm(f, null);
		// In caso di errore tornano anche le impostazioni della mappa o della cronologia, per non perderle.
		const columns = String(f.get('columns') ?? '').slice(0, 2000);
		const hex = readHexForm(f);
		const extra = { map: probe.values, mode, columns, hex: hex.values };
		if (!r.ok) return fail(400, { error: r.error, values: r.values, extra });
		const kind = r.input.kind ?? 'page';
		if (!canCreateKind(kind, u)) return fail(403, { error: 'errors.forbidden', values: r.values, extra });
		if (f.has('inside')) {
			const inside = nestTarget(f.get('inside'), u);
			if (!inside) return fail(403, { error: 'errors.forbidden', values: r.values, extra });
			r.input.parentPageId = inside.id;
			r.input.categoryId = inside.categoryId;
		}

		if (kind === 'map') {
			const image = f.get('image');
			if (!(image instanceof File) || image.size === 0) return fail(400, { error: 'files.empty', values: r.values, extra });
			const saved = saveImage(Buffer.from(await image.arrayBuffer()), image.name, u.id);
			if (!saved.ok) return fail(400, { error: saved.error, values: r.values, extra });
			const { input } = readMapForm(f, saved.file.width);
			const page = createPage(r.input, u, (p) => createMap(p, input, saved.file, u.id));
			redirect(303, `/wiki/${page.slug}`);
		}
		if (kind === 'hexmap') {
			const page = createPage(r.input, u, (p) => createHexMap(p.id, hex.input));
			redirect(303, `/wiki/${page.slug}`);
		}
		const after =
			kind === 'timeline'
				? (p: PageRow) => setTimelineMode(p.id, mode)
				: kind === 'board'
					? (p: PageRow) => createBoard(p.id, p.title, readColumns(columns), u.id)
					: undefined;
		const page = createPage(r.input, u, after);
		redirect(303, `/wiki/${page.slug}`);
	}
};
