import { and, eq } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { fileUsesOf, type FileRow } from './files.ts';
import { getSettings } from './settings.ts';
import { canView, type Viewer } from '../access.ts';

const { pages, maps, resources, campaigns, campaignMembers } = schema;

export interface FileViewer {
	user: { id: number; admin?: boolean } | null;
	/** La campagna della richiesta e la vista giocatore, se attiva (vale solo lì). */
	campaignId: number | null;
	asPlayer: boolean;
}

/** Chi chiede, visto da una campagna: il suo Master, un giocatore al tavolo, oppure nessuno (un visitatore, o un Admin che non ne fa parte). */
function viewerIn(campaignId: number, v: FileViewer): Viewer | null {
	if (!v.user) return null;
	const c = getDb().select({ masterId: campaigns.masterId }).from(campaigns).where(eq(campaigns.id, campaignId)).get();
	if (!c) return null;
	const master = c.masterId === v.user.id;
	if (!master) {
		const member = getDb()
			.select({ id: campaignMembers.userId })
			.from(campaignMembers)
			.where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, v.user.id)))
			.get();
		if (!member) return null;
	}
	const asPlayer = v.asPlayer && v.campaignId === campaignId;
	return { id: v.user.id, role: master && !asPlayer ? 'master' : 'player', asPlayer };
}

/**
 * Un file si scarica se chi chiede può vedere almeno una cosa che lo usa: una pagina (anche nel cestino, o in una versione
 * vecchia), una mappa, una risorsa, un tema o un avatar. Un file appena caricato e non ancora salvato in nulla lo vede
 * solo chi l'ha caricato; da quando è usato valgono solo le regole di ciò che lo usa (anche per chi l'ha caricato: nella
 * vista giocatore il Master non vede le immagini delle sue pagine segrete). I visitatori vedono i file delle pagine
 * pubbliche solo se sono ammessi.
 */
export function canDownload(f: FileRow, v: FileViewer): boolean {
	const visitors = getSettings().allowVisitors;
	if (!v.user && !visitors) return false;
	const uses = fileUsesOf(f.id);
	if (!uses.length) return !!v.user && f.uploadedBy === v.user.id;
	const pageOk = (pageId: number) => {
		const p = getDb()
			.select({ campaignId: pages.campaignId, visibility: pages.visibility, authorId: pages.authorId })
			.from(pages)
			.where(eq(pages.id, pageId))
			.get();
		if (!p) return false;
		const u = viewerIn(p.campaignId, v);
		if (!u && !visitors) return false;
		return canView({ ...p, playersCanEdit: false, hasSecret: false }, u);
	};
	for (const use of uses) {
		switch (use.kind) {
			case 'theme':
			case 'avatar':
				return true;
			case 'page':
				if (pageOk(use.refId)) return true;
				break;
			case 'map': {
				const m = getDb().select({ pageId: maps.pageId }).from(maps).where(eq(maps.id, use.refId)).get();
				if (m && pageOk(m.pageId)) return true;
				break;
			}
			case 'resource': {
				const r = getDb().select({ campaignId: resources.campaignId, visibility: resources.visibility }).from(resources).where(eq(resources.id, use.refId)).get();
				if (!r) break;
				const u = viewerIn(r.campaignId, v);
				if (r.visibility === 'public' ? !!u || visitors : r.visibility === 'players' ? !!u : u?.role === 'master') return true;
				break;
			}
		}
	}
	return false;
}
