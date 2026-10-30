import { error, fail } from '@sveltejs/kit';
import { canEdit, canView, type Viewer } from '../access.ts';
import {
	addCard,
	addColumn,
	boardContent,
	boardOfPage,
	CARD_COLORS,
	cardInBoard,
	columnInBoard,
	createBoard,
	deleteCard,
	deleteColumn,
	moveCard,
	renameColumn,
	shiftColumn,
	updateCard
} from './boards.ts';
import { resolverFor, type PageRow } from './pages.ts';
import { renderInline } from '../content/render.ts';
import { inlineLinks } from '../content/extract.ts';
import { contentLabels } from './pageForm.ts';
import { str } from './forms.ts';
import { hasRule } from './rules/index.ts';
import { translate } from '../i18n/index.ts';

/** La bacheca di una pagina «bacheca»; se manca (es. pagina da un pacchetto) nasce con le colonne di base. */
export function ensureBoard(page: PageRow, locale: string) {
	const b = boardOfPage(page.id);
	if (b) return b;
	createBoard(page.id, page.title, readDefault(locale), page.authorId);
	return boardOfPage(page.id)!;
}

const readDefault = (locale: string) => translate(locale, 'boards.defaultColumns').split('\n').filter(Boolean);

/** Quello che serve per mostrare la bacheca di una pagina «bacheca». */
export function boardView(page: PageRow, u: Viewer | null, locale: string) {
	const b = ensureBoard(page, locale);
	const columns = boardContent(b.id);
	const resolve = resolverFor(columns.flatMap((c) => c.cards.flatMap((k) => inlineLinks(k.body))), u);
	const labels = contentLabels(locale);
	return {
		id: b.id,
		// Le schede le usa chi ha fatto l'accesso e vede la pagina; le colonne le cambia chi può modificare la pagina.
		canUse: !!u,
		canManage: canEdit(page, u),
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
}

/** La bacheca della pagina, se chi scrive può usarla (o gestirla, con `manage`). */
export function usableBoard(page: PageRow | undefined, u: Viewer | null, manage = false) {
	if (!page || page.kind !== 'board' || !u || !canView(page, u)) error(404, 'Not found');
	if (manage && !canEdit(page, u)) error(403, 'Forbidden');
	const b = boardOfPage(page.id);
	if (!b) error(404, 'Not found');
	return b;
}

const cardInput = (f: FormData) => {
	const color = str(f, 'color');
	return {
		title: str(f, 'title', 120),
		body: str(f, 'body', 2000),
		color: (CARD_COLORS as readonly string[]).includes(color) ? color : 'yellow'
	};
};

type Act = (page: PageRow | undefined, u: Viewer | null, f: FormData) => unknown;

export const boardActions: Record<string, Act> = {
	addCard: (page, u, f) => {
		const b = usableBoard(page, u);
		const column = Number(f.get('columnId'));
		const input = cardInput(f);
		if (!columnInBoard(column, b.id)) return fail(400, { error: 'errors.generic' });
		if (!input.title) return fail(400, { error: 'errors.titleRequired' });
		addCard(column, input, u!.id);
		return { ok: 'boards.cardAdded' };
	},
	updateCard: (page, u, f) => {
		const b = usableBoard(page, u);
		const card = cardInBoard(Number(f.get('id')), b.id);
		const input = cardInput(f);
		if (!card) return fail(404, { error: 'errors.generic' });
		if (!input.title) return fail(400, { error: 'errors.titleRequired' });
		updateCard(card.id, input);
		return { ok: 'common.saved' };
	},
	deleteCard: (page, u, f) => {
		const b = usableBoard(page, u);
		const card = cardInBoard(Number(f.get('id')), b.id);
		if (card) deleteCard(card.id);
		return { ok: 'boards.cardDeleted' };
	},
	moveCard: (page, u, f) => {
		const b = usableBoard(page, u);
		const card = cardInBoard(Number(f.get('id')), b.id);
		const dir = str(f, 'dir');
		if (!card || !['up', 'down', 'left', 'right'].includes(dir)) return fail(400, { error: 'errors.generic' });
		moveCard(b.id, card.id, dir as 'up' | 'down' | 'left' | 'right');
		return { moved: card.id, dir };
	},
	addColumn: (page, u, f) => {
		const b = usableBoard(page, u, true);
		const title = str(f, 'title', 60);
		if (!title) return fail(400, { error: 'errors.titleRequired' });
		addColumn(b.id, title);
		return { ok: 'common.saved' };
	},
	renameColumn: (page, u, f) => {
		const b = usableBoard(page, u, true);
		const id = Number(f.get('id'));
		const title = str(f, 'title', 60);
		if (!columnInBoard(id, b.id) || !title) return fail(400, { error: 'errors.titleRequired' });
		renameColumn(id, title);
		return { ok: 'common.saved' };
	},
	shiftColumn: (page, u, f) => {
		const b = usableBoard(page, u, true);
		const id = Number(f.get('id'));
		if (columnInBoard(id, b.id)) shiftColumn(b.id, id, f.get('dir') === 'left' ? -1 : 1);
		return { ok: 'common.saved' };
	},
	deleteColumn: (page, u, f) => {
		const b = usableBoard(page, u, true);
		const id = Number(f.get('id'));
		if (columnInBoard(id, b.id)) deleteColumn(id);
		return { ok: 'boards.columnDeleted' };
	}
};
