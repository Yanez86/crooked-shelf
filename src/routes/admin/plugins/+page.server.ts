import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { allPlugins, enabledPlugins, pluginDirs, reloadPlugins, setPluginEnabled } from '#lib/server/plugins.ts';

export const load: PageServerLoad = () => {
	const on = new Set(enabledPlugins().map((p) => p.id));
	return {
		dirs: pluginDirs(),
		plugins: allPlugins().map((p) => ({
			id: p.id,
			name: p.name,
			version: p.version,
			description: p.description,
			author: p.author,
			license: p.license,
			enabled: on.has(p.id),
			counts: { themes: p.themes.length, templates: p.templates.length, calendars: p.calendars.length, locales: Object.keys(p.locales).length, rules: p.rules.length },
			warnings: p.warnings
		}))
	};
};

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const f = await request.formData();
		const id = String(f.get('id'));
		if (!allPlugins().some((p) => p.id === id)) return { ok: null };
		setPluginEnabled(id, f.get('on') === '1');
		return { ok: f.get('on') === '1' ? 'plugins.enabled' : 'plugins.disabled' };
	},
	reload: async ({ locals }) => {
		requireAdmin(locals.user);
		reloadPlugins();
		return { ok: 'plugins.reloaded' };
	}
};
