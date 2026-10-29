import { error, fail, redirect } from '@sveltejs/kit';
import { diffLines } from 'diff';
import type { Actions, PageServerLoad } from './$types';
import { canEdit, canView, isMaster } from '#lib/access.ts';
import { getPageBySlug, getRevision, linkResolver, listRevisions, pageMeta, revisionText, updatePage } from '#lib/server/pages.ts';
import { renderDoc } from '#lib/content/render.ts';
import { EMPTY_DOC, isDoc } from '#lib/content/types.ts';
import { contentLabels } from '#lib/server/pageForm.ts';
import { hasRule } from '#lib/server/rules/index.ts';

function visiblePage(slug: string, u: App.Locals['user']) {
	const page = getPageBySlug(slug);
	if (!page || !canView(page, u)) error(404, 'Not found');
	return page;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const page = visiblePage(params.slug, locals.user);
	const revisions = listRevisions(page, locals.user);
	const pick = Number(url.searchParams.get('rev'));
	const diffId = Number(url.searchParams.get('diff'));

	let view: { id: number; title: string; html: string } | null = null;
	if (pick) {
		const r = getRevision(page, pick, locals.user);
		if (!r) error(404, 'Not found');
		const doc = isDoc(r.content) ? r.content : EMPTY_DOC;
		view = {
			id: r.id,
			title: r.title,
			html: renderDoc(doc, { showSecrets: isMaster(locals.user), resolve: linkResolver(doc, locals.user, r.fields ?? []), labels: contentLabels(locals.locale), hasRule })
		};
	}

	let diff: { id: number; prevId: number | null; parts: { type: 'add' | 'del' | 'same'; text: string }[] } | null = null;
	if (diffId) {
		const r = getRevision(page, diffId, locals.user);
		if (!r) error(404, 'Not found');
		// Confronto con la versione precedente che chi guarda può vedere.
		const idx = revisions.findIndex((x) => x.id === r.id);
		const prevMeta = revisions[idx + 1];
		const prev = prevMeta ? getRevision(page, prevMeta.id, locals.user) : undefined;
		const parts = diffLines(prev ? revisionText(prev, locals.user) : '', revisionText(r, locals.user));
		diff = {
			id: r.id,
			prevId: prev?.id ?? null,
			parts: parts.map((p) => ({ type: p.added ? 'add' : p.removed ? 'del' : 'same', text: p.value }))
		};
	}

	return {
		page: { slug: page.slug, title: page.title },
		revisions,
		view,
		diff,
		canRestore: canEdit(page, locals.user),
		latestId: revisions[0]?.id ?? null,
		tagsCount: pageMeta(page).tags.length
	};
};

export const actions: Actions = {
	restore: async ({ params, request, locals }) => {
		const page = visiblePage(params.slug, locals.user);
		if (!canEdit(page, locals.user)) return fail(403, { error: 'errors.forbidden' });
		const r = getRevision(page, Number((await request.formData()).get('id')), locals.user);
		if (!r) return fail(404, { error: 'errors.generic' });
		const meta = pageMeta(page);
		updatePage(
			page,
			{
				title: r.title,
				content: r.content,
				fields: r.fields ?? [],
				visibility: page.visibility,
				playersCanEdit: page.playersCanEdit,
				categoryId: page.categoryId,
				tags: meta.tags.map((t) => t.name),
				session: page.session ?? null
			},
			locals.user!,
			false
		);
		redirect(303, `/wiki/${page.slug}?restored=1`);
	}
};
