import { allowedVisibilities, type Viewer } from '../access.ts';
import type { Visibility } from '../roles.ts';
import { getCategory, parseTagNames } from './taxonomy.ts';
import type { PageInput } from './pages.ts';
import { TITLE_MAX } from './pages.ts';
import { str } from './forms.ts';
import { translate } from '../i18n/index.ts';

const CONTENT_MAX = 2_000_000;

export interface PageFormValues {
	title: string;
	content: unknown;
	visibility: string;
	playersCanEdit: boolean;
	categoryId: number | null;
	tags: string;
	slug: string;
}

/** Legge e controlla il modulo di una pagina. In caso di errore restituisce anche i valori, per non perdere il lavoro. */
export function readPageForm(
	f: FormData,
	u: Viewer
): { ok: true; input: PageInput } | { ok: false; error: string; values: PageFormValues } {
	const raw = String(f.get('content') ?? '');
	let content: unknown = null;
	try {
		content = raw.length <= CONTENT_MAX ? JSON.parse(raw) : null;
	} catch {
		content = null;
	}
	const catRaw = Number(f.get('categoryId'));
	const values: PageFormValues = {
		title: str(f, 'title', TITLE_MAX),
		content,
		visibility: str(f, 'visibility'),
		playersCanEdit: f.get('playersCanEdit') === 'on',
		categoryId: Number.isInteger(catRaw) && catRaw > 0 ? catRaw : null,
		tags: str(f, 'tags', 2000),
		slug: str(f, 'slug', 100)
	};
	const fail = (error: string) => ({ ok: false as const, error, values });
	if (!values.title) return fail('errors.titleRequired');
	if (raw.length > CONTENT_MAX) return fail('errors.tooLong');
	if (!content) return fail('errors.generic');
	if (!allowedVisibilities(u).includes(values.visibility as Visibility)) return fail('errors.generic');
	if (values.categoryId && !getCategory(values.categoryId)) values.categoryId = null;
	return {
		ok: true,
		input: {
			title: values.title,
			content,
			visibility: values.visibility as Visibility,
			playersCanEdit: values.playersCanEdit,
			categoryId: values.categoryId,
			tags: parseTagNames(values.tags),
			slug: values.slug || undefined
		}
	};
}

export const contentLabels = (locale: string) => ({
	secret: translate(locale, 'editor.secret'),
	note: translate(locale, 'editor.note'),
	tip: translate(locale, 'editor.tip'),
	warning: translate(locale, 'editor.warning'),
	missing: translate(locale, 'page.missing')
});
