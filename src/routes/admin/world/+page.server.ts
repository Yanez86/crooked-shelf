import { fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { importPack, previewPack, readPack, type Conflict } from '#lib/server/worldpack.ts';
import { dataDir } from '#lib/server/db/index.ts';

const tmpDir = () => join(dataDir(), 'tmp');
const tmpPath = (token: string) => join(tmpDir(), `${token}.shelf`);

export const load: PageServerLoad = ({ locals }) => ({
	categories: categoryTree(locals.user).flat.map(({ id, label, count }) => ({ id, label, count })),
	tags: listTags(locals.user).map(({ id, name, count }) => ({ id, name, count }))
});

export const actions: Actions = {
	// Primo passo: si carica il file e si mostra cosa contiene.
	preview: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'files.empty' });
		const buf = new Uint8Array(await file.arrayBuffer());
		const r = readPack(buf);
		if (!r.ok) return fail(400, { error: r.error });
		const token = randomBytes(12).toString('hex');
		mkdirSync(tmpDir(), { recursive: true });
		writeFileSync(tmpPath(token), buf);
		return { token, preview: previewPack(r.pack) };
	},
	// Secondo passo: si importa con le scelte fatte.
	import: async ({ request, locals }) => {
		const u = requireAdmin(locals.user);
		const f = await request.formData();
		const token = String(f.get('token') ?? '');
		if (!/^[0-9a-f]{24}$/.test(token) || !existsSync(tmpPath(token))) return fail(400, { error: 'world.errExpired' });
		const r = readPack(readFileSync(tmpPath(token)));
		rmSync(tmpPath(token), { force: true });
		if (!r.ok) return fail(400, { error: r.error });
		const conflict = (['skip', 'rename', 'replace'].includes(String(f.get('conflict'))) ? f.get('conflict') : 'rename') as Conflict;
		const done = importPack(r.pack, { conflict, calendar: f.get('calendar') === 'on' }, u);
		return { done };
	}
};
