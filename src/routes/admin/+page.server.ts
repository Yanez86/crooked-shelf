import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSettings, saveSettings } from '#lib/server/settings.ts';
import { isLocale, localeNames } from '#lib/i18n/index.ts';
import { requireAdmin } from '#lib/server/guard.ts';
import { str } from '#lib/server/forms.ts';
import { checkUpdate } from '#lib/server/updates.ts';

// Il controllo della versione non si aspetta: la pagina arriva subito e il risultato la raggiunge appena GitHub risponde.
export const load: PageServerLoad = () => ({ settings: getSettings(), locales: localeNames(), update: checkUpdate() });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const f = await request.formData();
		const siteName = str(f, 'siteName', 80);
		const defaultLocale = str(f, 'defaultLocale');
		if (!siteName) return fail(400, { error: 'errors.nameRequired' });
		if (!isLocale(defaultLocale)) return fail(400, { error: 'errors.generic' });
		saveSettings({ siteName, defaultLocale, allowVisitors: f.get('allowVisitors') === 'on' });
		return { ok: 'common.saved' };
	}
};
