import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addCard,
	addColumn,
	boardContent,
	canManageBoard,
	canSeeBoard,
	CARD_COLORS,
	cardInBoard,
	columnInBoard,
	deleteBoard,
	deleteCard,
	deleteColumn,
	getBoard,
	moveCard,
	renameColumn,
	shiftColumn,
	updateBoard,
	updateCard
} from '#lib/server/boards.ts';
import { resolverFor } from '#lib/server/pages.ts';
import { hasRule } from '#lib/server/rules/index.ts';
import { renderInline } from '#lib/content/render.ts';
import { inlineLinks } from '#lib/content/extract.ts';
import { contentLabels } from '#lib/server/pageForm.ts';
import { str } from '#lib/server/forms.ts';

function visible(id: string, u: App.Locals['user']) {
	const b = getBoard(Number(id));
	if (!b || !canSeeBoard(b, u)) error(404, 'Not found');
	return b;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const b = visible(params.id, locals.user);
	const columns = boardContent(b.id);
	const resolve = resolverFor(columns.flatMap((c) => c.cards.flatMap((k) => inlineLinks(k.body))), locals.user);
	const labels = contentLabels(locals.locale);
	return {
		board: { id: b.id, title: b.title, personal: b.ownerId !== null, visibility: b.visibility },
		canManage: canManageBoard(b, locals.user),
		colors: [...CARD_COLORS],
		columns: columns.map((c) => ({
			...c,
			cards: c.cards.map((k) => ({
				...k,
				html: k.body
					.split('\n')
					.map((line) => renderInline(line, { resolve, labels, hasRule }))
					.join('<br>')
			}))
		}))
	};
};

const cardInput = (f: FormData) => {
	const color = str(f, 'color');
	return {
		title: str(f, 'title', 120),
		body: str(f, 'body', 2000),
		color: (CARD_COLORS as readonly string[]).includes(color) ? color : 'yellow'
	};
};

/** Azione sulla bacheca: chi la vede può usare le schede; colonne e bacheca solo chi la gestisce. */
async function act(params: { id: string }, request: Request, u: App.Locals['user'], manage = false) {
	const b = visible(params.id, u);
	if (manage && !canManageBoard(b, u)) error(403, 'Forbidden');
	return { b, f: await request.formData() };
}

export const actions: Actions = {
	addCard: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user);
		const column = Number(f.get('columnId'));
		const input = cardInput(f);
		if (!columnInBoard(column, b.id)) return fail(400, { error: 'errors.generic' });
		if (!input.title) return fail(400, { error: 'errors.titleRequired' });
		addCard(column, input, locals.user!.id);
		return { ok: 'boards.cardAdded' };
	},
	updateCard: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user);
		const card = cardInBoard(Number(f.get('id')), b.id);
		const input = cardInput(f);
		if (!card) return fail(404, { error: 'errors.generic' });
		if (!input.title) return fail(400, { error: 'errors.titleRequired' });
		updateCard(card.id, input);
		return { ok: 'common.saved' };
	},
	deleteCard: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user);
		const card = cardInBoard(Number(f.get('id')), b.id);
		if (card) deleteCard(card.id);
		return { ok: 'boards.cardDeleted' };
	},
	moveCard: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user);
		const card = cardInBoard(Number(f.get('id')), b.id);
		const dir = str(f, 'dir');
		if (!card || !['up', 'down', 'left', 'right'].includes(dir)) return fail(400, { error: 'errors.generic' });
		moveCard(b.id, card.id, dir as 'up' | 'down' | 'left' | 'right');
		return { moved: card.id, dir };
	},
	addColumn: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user, true);
		const title = str(f, 'title', 60);
		if (!title) return fail(400, { error: 'errors.titleRequired' });
		addColumn(b.id, title);
		return { ok: 'common.saved' };
	},
	renameColumn: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user, true);
		const id = Number(f.get('id'));
		const title = str(f, 'title', 60);
		if (!columnInBoard(id, b.id) || !title) return fail(400, { error: 'errors.titleRequired' });
		renameColumn(id, title);
		return { ok: 'common.saved' };
	},
	shiftColumn: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user, true);
		const id = Number(f.get('id'));
		if (columnInBoard(id, b.id)) shiftColumn(b.id, id, f.get('dir') === 'left' ? -1 : 1);
		return { ok: 'common.saved' };
	},
	deleteColumn: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user, true);
		const id = Number(f.get('id'));
		if (columnInBoard(id, b.id)) deleteColumn(id);
		return { ok: 'boards.columnDeleted' };
	},
	updateBoard: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user, true);
		const title = str(f, 'title', 80);
		if (!title) return fail(400, { error: 'errors.titleRequired' });
		updateBoard(b.id, title, b.ownerId === null && f.get('visibility') === 'master' ? 'master' : 'players');
		return { ok: 'common.saved' };
	},
	deleteBoard: async ({ params, request, locals }) => {
		const { b, f } = await act(params, request, locals.user, true);
		if (f.get('confirm') !== 'on') return fail(400, { error: 'errors.confirm' });
		deleteBoard(b.id);
		redirect(303, '/boards?deleted=1');
	}
};
