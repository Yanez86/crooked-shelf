import type { PageServerLoad } from './$types';
import { galleryImages } from '#lib/server/gallery.ts';

const FILTERS = ['all', 'pages', 'maps', 'resources'] as const;
type Filter = (typeof FILTERS)[number];

export const load: PageServerLoad = ({ url, locals }) => {
	const raw = url.searchParams.get('show');
	const show: Filter = FILTERS.includes(raw as Filter) ? (raw as Filter) : 'all';
	const all = galleryImages(locals.user);
	const pages = all.filter((i) => i.sources.some((s) => s.kind === 'cover' || s.kind === 'content'));
	const maps = all.filter((i) => i.sources.some((s) => s.kind === 'map'));
	const resources = all.filter((i) => i.sources.some((s) => s.kind === 'resource'));
	const lists = { all, pages, maps, resources };
	return {
		images: lists[show],
		show,
		filters: FILTERS.map((f) => ({ id: f, count: lists[f].length }))
	};
};
