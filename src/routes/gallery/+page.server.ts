import type { PageServerLoad } from './$types';
import { galleryImages } from '#lib/server/gallery.ts';

const FILTERS = ['all', 'pages', 'maps'] as const;
type Filter = (typeof FILTERS)[number];

export const load: PageServerLoad = ({ url, locals }) => {
	const raw = url.searchParams.get('show');
	const show: Filter = FILTERS.includes(raw as Filter) ? (raw as Filter) : 'all';
	const all = galleryImages(locals.user);
	const pages = all.filter((i) => i.sources.some((s) => s.kind !== 'map'));
	const maps = all.filter((i) => i.sources.some((s) => s.kind === 'map'));
	return {
		images: { all, pages, maps }[show],
		show,
		filters: FILTERS.map((f) => ({ id: f, count: { all, pages, maps }[f].length }))
	};
};
