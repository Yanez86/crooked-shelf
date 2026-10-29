import type { PageServerLoad } from './$types';
import { searchPages, snippetHtml } from '#lib/server/search.ts';

export const load: PageServerLoad = ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const hits = q ? searchPages(q, locals.user) : [];
	return { q, hits: hits.map((h) => ({ slug: h.slug, title: h.title, snippet: snippetHtml(h.snippet) })) };
};
