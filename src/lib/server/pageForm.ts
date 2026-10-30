import { allowedVisibilities, type Viewer } from '../access.ts';
import type { Visibility } from '../roles.ts';
import { getCategory, parseTagNames } from './taxonomy.ts';
import type { PageInput } from './pages.ts';
import { TITLE_MAX } from './pages.ts';
import { str } from './forms.ts';
import { translate } from '../i18n/index.ts';
import type { PageField, SessionInfo, WorldDate } from '../content/types.ts';
import { validDate, type Calendar } from '../calendar.ts';
import { REAL_DATE } from './timeline.ts';
import { pageIcon } from '../pageIcons.ts';
import { getFile } from './files.ts';
import { isPageKind, type PageKind } from '../pageKinds.ts';
import { SESSION_TEMPLATE } from '../templates.ts';

const CONTENT_MAX = 2_000_000;

export interface PageFormValues {
	title: string;
	content: unknown;
	visibility: string;
	playersCanEdit: boolean;
	categoryId: number | null;
	tags: string;
	slug: string;
	fields: PageField[];
	template: string | null;
	session: SessionInfo | null;
	icon: string | null;
	kind: PageKind;
}

/**
 * Riquadri della colonna a lato, ripuliti. `image` dice quale file mostra un riquadro immagine
 * (null = il file non va bene e il riquadro si toglie).
 */
export function cleanFields(raw: unknown, image: (id: string) => string | null): PageField[] {
	if (!Array.isArray(raw)) return [];
	const out: PageField[] = [];
	for (const f of raw) {
		if (!f || typeof f !== 'object') continue;
		const label = typeof f.label === 'string' ? f.label.trim() : '';
		const value = typeof f.value === 'string' ? f.value.trim() : '';
		if (f.image !== undefined) {
			const id = typeof f.image === 'string' ? image(f.image) : null;
			if (id) out.push({ label: label.slice(0, 200), value: '', image: id });
		} else if (label || value) out.push({ label: label.slice(0, 60), value: value.slice(0, 500) });
	}
	return out.slice(0, 30);
}

/** Solo immagini già caricate: un riquadro non mostra un PDF né un file che non c'è. */
const imageFile = (id: string) => (getFile(id)?.mime.startsWith('image/') ? id : null);

function parseFields(raw: string): PageField[] {
	try {
		return cleanFields(JSON.parse(raw || '[]'), imageFile);
	} catch {
		return [];
	}
}

const num = (v: FormDataEntryValue | null) => {
	const s = String(v ?? '').trim();
	return /^-?\d{1,7}$/.test(s) ? Number(s) : null;
};

/** Data nel mondo da tre campi (anno, mese, giorno). undefined = data non valida. */
export function readWorldDate(f: FormData, prefix: string, cal: Calendar): WorldDate | null | undefined {
	const year = num(f.get(prefix + 'Year'));
	const month = num(f.get(prefix + 'Month'));
	const day = num(f.get(prefix + 'Day'));
	if (year === null) return month === null && day === null ? null : undefined;
	const d = { year, month, day };
	return validDate(cal, d) ? d : undefined;
}

/** Legge e controlla il modulo di una pagina. In caso di errore restituisce anche i valori, per non perdere il lavoro. */
export function readPageForm(
	f: FormData,
	u: Viewer,
	cal: Calendar
): { ok: true; input: PageInput; values: PageFormValues } | { ok: false; error: string; values: PageFormValues } {
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
		slug: str(f, 'slug', 100),
		fields: parseFields(String(f.get('fields') ?? '')),
		template: str(f, 'template', 120) || null,
		session: null,
		icon: pageIcon(f.get('icon')),
		// Il tipo arriva dal modulo (nuova mappa, nuova cronologia…); chi chiama controlla che sia permesso.
		kind: isPageKind(f.get('kind')) ? (f.get('kind') as PageKind) : 'page'
	};
	// Pagina o template: lo dice la casella, che c'è solo per chi può fare template.
	if (f.get('kindSwitch') === '1' && (values.kind === 'page' || values.kind === 'template')) values.kind = f.get('asTemplate') === 'on' ? 'template' : 'page';
	let badDate = false;
	if (values.kind === 'template') values.session = f.get('sessionTemplate') === 'on' ? SESSION_TEMPLATE : null;
	else if (f.get('isSession') === '1') {
		const realDate = str(f, 'sessionDate', 10);
		const world = readWorldDate(f, 'sessionWorld', cal);
		badDate = world === undefined || (!!realDate && !REAL_DATE.test(realDate));
		values.session = {
			number: num(f.get('sessionNumber')),
			realDate: realDate && REAL_DATE.test(realDate) ? realDate : null,
			world: world ?? null
		};
	}
	const fail = (error: string) => ({ ok: false as const, error, values });
	if (!values.title) return fail('errors.titleRequired');
	if (raw.length > CONTENT_MAX) return fail('errors.tooLong');
	if (!content) return fail('errors.generic');
	if (badDate) return fail('timeline.errDate');
	if (!allowedVisibilities(u).includes(values.visibility as Visibility)) return fail('errors.generic');
	if (values.categoryId && !getCategory(values.categoryId)) values.categoryId = null;
	return {
		ok: true,
		values,
		input: {
			title: values.title,
			content,
			visibility: values.visibility as Visibility,
			playersCanEdit: values.playersCanEdit,
			categoryId: values.categoryId,
			tags: parseTagNames(values.tags),
			slug: values.slug || undefined,
			fields: values.fields,
			template: values.template,
			session: values.session,
			icon: values.icon,
			kind: values.kind
		}
	};
}

export const contentLabels = (locale: string) => ({
	secret: translate(locale, 'editor.secret'),
	note: translate(locale, 'editor.note'),
	tip: translate(locale, 'editor.tip'),
	warning: translate(locale, 'editor.warning'),
	missing: translate(locale, 'page.missing'),
	preview: translate(locale, 'rules.preview'),
	external: translate(locale, 'rules.external')
});
