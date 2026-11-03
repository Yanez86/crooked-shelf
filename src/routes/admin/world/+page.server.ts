import { fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { masterCandidates } from '#lib/server/campaigns.ts';
import { str } from '#lib/server/forms.ts';
import { importAsCampaign, importPack, previewPack, readPack, type Conflict } from '#lib/server/worldpack.ts';
import { dataDir } from '#lib/server/db/index.ts';
import { isMaster } from '#lib/access.ts';

const tmpDir = () => join(dataDir(), 'tmp');
const tmpPath = (token: string) => join(tmpDir(), `${token}.shelf`);

export const load: PageServerLoad = ({ locals }) => ({
	categories: categoryTree(locals.user).flat.map(({ id, label, count }) => ({ id, label, count })),
	tags: listTags(locals.user).map(({ id, name, count }) => ({ id, name, count })),
	// Per importare in una campagna nuova: chi la può tenere, come in Amministrazione › Campagne.
	masters: masterCandidates(),
	me: locals.user?.id ?? null,
	// Segreti e importazione in questa campagna solo per chi ne è il Master: un Admin che qui è giocatore ne fa una nuova.
	master: isMaster(locals.user)
});

export const actions: Actions = {
	// Primo passo: si carica il file e si mostra cosa contiene.
	preview: async ({ request, locals }) => {
		const u = requireAdmin(locals.user);
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'files.empty' });
		const buf = new Uint8Array(await file.arrayBuffer());
		const r = readPack(buf);
		if (!r.ok) return fail(400, { error: r.error });
		const token = randomBytes(12).toString('hex');
		mkdirSync(tmpDir(), { recursive: true });
		writeFileSync(tmpPath(token), buf);
		return { token, preview: previewPack(r.pack, u) };
	},
	// Secondo passo: si importa con le scelte fatte, in questa campagna o in una nuova.
	import: async ({ request, locals }) => {
		const u = requireAdmin(locals.user);
		const f = await request.formData();
		const token = String(f.get('token') ?? '');
		if (!/^[0-9a-f]{24}$/.test(token) || !existsSync(tmpPath(token))) return fail(400, { error: 'world.errExpired' });
		const r = readPack(readFileSync(tmpPath(token)));
		if (!r.ok) {
			rmSync(tmpPath(token), { force: true });
			return fail(400, { error: r.error });
		}
		if (f.get('target') === 'new') {
			const name = str(f, 'name', 80);
			const masterId = Number(f.get('masterId'));
			// Il file resta: si corregge il modulo senza ricaricarlo.
			const error = !name ? 'errors.nameRequired' : !masterCandidates().some((m) => m.id === masterId) ? 'errors.generic' : null;
			if (error) return fail(400, { error, token, preview: previewPack(r.pack, u) });
			rmSync(tmpPath(token), { force: true });
			const { campaign, done } = importAsCampaign(r.pack, { name, master: { id: masterId, role: 'master' } });
			// Si entra solo nelle campagne che si tengono: quella di un altro Master si gestisce da Amministrazione › Campagne.
			return { done, campaign: { id: campaign.id, name: campaign.name, open: masterId === u.id } };
		}
		if (!isMaster(u)) return fail(403, { error: 'world.errNotMaster', token, preview: previewPack(r.pack, u) });
		rmSync(tmpPath(token), { force: true });
		const conflict = (['skip', 'rename', 'replace'].includes(String(f.get('conflict'))) ? f.get('conflict') : 'rename') as Conflict;
		const done = importPack(r.pack, { conflict, calendar: f.get('calendar') === 'on' }, u);
		return { done };
	}
};
