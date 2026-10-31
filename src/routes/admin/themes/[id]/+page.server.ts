import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { saveImage } from '#lib/server/files.ts';
import { findTheme, storeTheme } from '#lib/server/themesAdmin.ts';
import { COLOR_KEYS, checkTheme, THEMES } from '#lib/themes.ts';
import { translate } from '#lib/i18n/index.ts';

export const load: PageServerLoad = ({ params, url, locals }) => {
	const isNew = params.id === 'new';
	const th = isNew ? findTheme(url.searchParams.get('from') ?? 'light') ?? THEMES[0] : findTheme(params.id);
	if (!th || (!isNew && !th.id.startsWith('custom-'))) error(404, 'Not found');
	const base = th.name ?? translate(locals.locale, `themes.${th.id}`);
	return {
		isNew,
		keys: COLOR_KEYS,
		theme: {
			name: isNew ? translate(locals.locale, 'themes.copyOf', { name: base }) : base,
			scheme: th.scheme,
			colors: { ...th.colors },
			background: isNew ? undefined : th.background
		},
		imported: url.searchParams.has('imported')
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const u = requireAdmin(locals.user);
		const f = await request.formData();
		const raw = {
			name: String(f.get('name') ?? ''),
			scheme: String(f.get('scheme') ?? ''),
			colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, String(f.get(k) ?? '')]))
		};
		const r = checkTheme(raw);
		if (!r.ok) return fail(400, { error: r.error, problems: r.problems ?? [], values: raw });
		const isNew = params.id === 'new';
		const current = isNew ? undefined : findTheme(params.id);
		if (!isNew && !current?.id.startsWith('custom-')) error(404, 'Not found');
		let background = f.get('removeBackground') ? undefined : current?.background;
		const upload = f.get('background');
		if (upload instanceof File && upload.size) {
			const saved = saveImage(Buffer.from(await upload.arrayBuffer()), upload.name, u.id);
			if (!saved.ok) return fail(400, { error: saved.error, problems: [], values: raw });
			background = saved.file.id;
		}
		const id = storeTheme({ ...r.theme, background }, isNew ? null : params.id);
		redirect(303, `/admin/themes/${id}?saved=1`);
	}
};
