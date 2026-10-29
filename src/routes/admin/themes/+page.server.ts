import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { customThemes } from '#lib/server/settings.ts';
import { THEMES, checkTheme } from '#lib/themes.ts';
import { removeTheme, storeTheme } from '#lib/server/themesAdmin.ts';

export const load: PageServerLoad = () => ({
	builtin: THEMES.map(({ id, colors }) => ({ id, colors })),
	custom: customThemes().map(({ id, name, colors }) => ({ id, name: name ?? id, colors }))
});

export const actions: Actions = {
	import: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0 || file.size > 100_000) return fail(400, { error: 'themes.errFile', problems: [] });
		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			return fail(400, { error: 'themes.errFile', problems: [] });
		}
		const r = checkTheme(parsed);
		if (!r.ok) return fail(400, { error: r.error, problems: r.problems ?? [] });
		const id = storeTheme(r.theme, null);
		redirect(303, `/admin/themes/${id}?imported=1`);
	},
	delete: async ({ request, locals }) => {
		requireAdmin(locals.user);
		removeTheme(String((await request.formData()).get('id')));
		return { ok: 'themes.deleted' };
	}
};
