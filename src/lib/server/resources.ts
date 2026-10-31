import { and, eq, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { campaignId, ofCampaign } from './campaigns.ts';
import { str } from './forms.ts';
import { deleteFile } from './files.ts';
import { isMaster, type Viewer } from '../access.ts';
import { kindOf, type ResourceKind } from '../resources.ts';

const { resources, files } = schema;

export type ResourceVisibility = 'public' | 'players' | 'master';
const VIS: ResourceVisibility[] = ['public', 'players', 'master'];

export interface ResourceInput {
	title: string;
	description: string;
	visibility: ResourceVisibility;
}

export interface Resource extends ResourceInput {
	id: number;
	kind: ResourceKind;
	file: { id: string; name: string; mime: string; size: number; width: number; height: number };
}

// Come le mappe: le pubbliche per tutti, quelle dei giocatori a chi ha un account, il resto solo al Master.
function visibleTo(u: Viewer | null): SQL {
	if (!u) return sql`${resources.visibility} = 'public'`;
	return isMaster(u) ? sql`1=1` : sql`${resources.visibility} IN ('public','players')`;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function select(where: SQL) {
	return getDb()
		.select({
			id: resources.id,
			title: resources.title,
			description: resources.description,
			visibility: resources.visibility,
			file: { id: files.id, name: files.name, mime: files.mime, size: files.size, width: files.width, height: files.height }
		})
		.from(resources)
		.innerJoin(files, eq(files.id, resources.fileId))
		.where(and(ofCampaign(resources), where))
		.all()
		.map((r): Resource => ({ ...r, kind: kindOf(r.file.mime) }));
}

/** Le risorse che chi guarda può vedere, in ordine di titolo. */
export function listResources(u: Viewer | null): Resource[] {
	return select(visibleTo(u)).sort((a, b) => collator.compare(a.title, b.title) || a.id - b.id);
}

export function getResource(id: number, u: Viewer | null): Resource | undefined {
	if (!Number.isInteger(id)) return undefined;
	return select(and(eq(resources.id, id), visibleTo(u))!)[0];
}

export function createResource(input: ResourceInput, fileId: string, userId: number): number {
	const now = Date.now();
	return getDb()
		.insert(resources)
		.values({ ...input, campaignId: campaignId(), fileId, createdBy: userId, createdAt: now, updatedAt: now })
		.returning({ id: resources.id })
		.get().id;
}

/** Con `fileId` il file cambia: quello vecchio si elimina. */
export function updateResource(id: number, input: ResourceInput, fileId?: string) {
	const old = getDb().select({ fileId: resources.fileId }).from(resources).where(and(ofCampaign(resources), eq(resources.id, id))).get();
	if (!old) return;
	getDb()
		.update(resources)
		.set({ ...input, ...(fileId ? { fileId } : {}), updatedAt: Date.now() })
		.where(eq(resources.id, id))
		.run();
	if (fileId && fileId !== old.fileId) deleteFile(old.fileId);
}

export function deleteResource(id: number) {
	const r = getDb().delete(resources).where(and(ofCampaign(resources), eq(resources.id, id))).returning({ fileId: resources.fileId }).get();
	if (r) deleteFile(r.fileId);
}

/** Legge il modulo di una risorsa. Senza titolo si usa il nome del file, senza estensione. */
export function readResourceForm(f: FormData, fileName = '') {
	const vis = str(f, 'visibility') as ResourceVisibility;
	const input: ResourceInput = {
		title: str(f, 'title', 120) || fileName.replace(/\.[^.]+$/, '').trim().slice(0, 120),
		description: str(f, 'description', 2000),
		visibility: VIS.includes(vis) ? vis : 'players'
	};
	return { input, error: input.title ? null : 'errors.titleRequired' };
}
