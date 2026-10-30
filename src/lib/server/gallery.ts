import { inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { visibleTo } from './visibility.ts';
import { listMaps } from './maps.ts';
import { listResources } from './resources.ts';
import { stripSecrets, uploadedImages } from '../content/extract.ts';
import { EMPTY_DOC, isDoc } from '../content/types.ts';
import { isMaster, type Viewer } from '../access.ts';

const { pages, files } = schema;

/** Dove compare un'immagine: colonna a lato di una pagina, nel testo di una pagina, mappa, risorsa. */
export const GALLERY_KINDS = ['cover', 'content', 'map', 'resource'] as const;
export type GalleryKind = (typeof GALLERY_KINDS)[number];

export interface GallerySource {
	kind: GalleryKind;
	title: string;
	href: string;
}

export interface GalleryImage {
	id: string;
	url: string;
	width: number;
	height: number;
	alt: string;
	createdAt: number;
	sources: GallerySource[];
}

/**
 * Le immagini della campagna che chi guarda può vedere: quelle nella colonna a lato delle pagine e nel testo
 * (dentro i segreti solo per il Master), le mappe e le risorse. Le più recenti prima.
 */
export function galleryImages(u: Viewer | null): GalleryImage[] {
	const uses = new Map<string, { alt: string; fallback: string; sources: GallerySource[] }>();
	const add = (id: string, source: GallerySource, alt = '') => {
		const e = uses.get(id) ?? { alt: '', fallback: source.title, sources: [] };
		if (!e.alt && alt) e.alt = alt;
		if (!e.sources.some((s) => s.kind === source.kind && s.href === source.href)) e.sources.push(source);
		uses.set(id, e);
	};

	const secrets = isMaster(u);
	const rows = getDb()
		.select({ slug: pages.slug, title: pages.title, content: pages.content, fields: pages.fields })
		.from(pages)
		.where(visibleTo(u))
		.orderBy(sql`${pages.title} COLLATE NOCASE`)
		.all();
	for (const p of rows) {
		const href = `/wiki/${p.slug}`;
		for (const f of p.fields ?? []) if (f.image) add(f.image, { kind: 'cover', title: p.title, href }, f.label);
		const doc = isDoc(p.content) ? p.content : EMPTY_DOC;
		for (const img of uploadedImages(secrets ? doc : stripSecrets(doc))) add(img.id, { kind: 'content', title: p.title, href }, img.alt);
	}
	for (const m of listMaps(u)) add(m.fileId, { kind: 'map', title: m.title, href: `/maps/${m.slug}` });
	for (const r of listResources(u)) if (r.kind === 'image') add(r.file.id, { kind: 'resource', title: r.title, href: `/resources/${r.id}` });

	if (!uses.size) return [];
	return getDb()
		.select({ id: files.id, width: files.width, height: files.height, createdAt: files.createdAt })
		.from(files)
		.where(inArray(files.id, [...uses.keys()]))
		.all()
		.map((f) => {
			const e = uses.get(f.id)!;
			return { ...f, url: `/files/${f.id}`, alt: e.alt || e.fallback, sources: e.sources };
		})
		.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}
