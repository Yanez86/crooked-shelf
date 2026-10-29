import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { findTheme } from '#lib/server/themesAdmin.ts';
import { translate } from '#lib/i18n/index.ts';

/** Il tema come file JSON, da importare in un'altra wiki. */
export const GET: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals.user);
	const th = findTheme(params.id);
	if (!th) error(404, 'Not found');
	const name = th.name ?? translate(locals.locale, `themes.${th.id}`);
	const body = JSON.stringify({ format: 'crooked-shelf-theme', version: 1, name, scheme: th.scheme, colors: th.colors }, null, 2);
	return new Response(body, {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="${th.id}.theme.json"`
		}
	});
};
