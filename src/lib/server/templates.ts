import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { createPage, getPageById, getPageBySlug, type PageRow } from './pages.ts';
import { campaignId, currentCampaign, inCampaign, insertCampaign, ofCampaign, saveCampaign, type CampaignRow } from './campaigns.ts';
import { createCategory, getCategoryBySlug, syncBranch } from './taxonomy.ts';
import { setTimelineMode } from './timeline.ts';
import { enabledPlugins, pluginTemplates } from './plugins.ts';
import { visibleTo } from './visibility.ts';
import { BUILTIN_TEMPLATES, builtinTemplate, SESSION_TEMPLATE, type TemplateData } from '../templates.ts';
import { stripSecrets } from '../content/extract.ts';
import { EMPTY_DOC, isDoc, type DocNode, type PageField } from '../content/types.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import { translate } from '../i18n/index.ts';
import { slugify } from '../slug.ts';
import { TIMELINE_MODES } from '../pageKinds.ts';

const { pages } = schema;

/** I template che chi guarda può fotocopiare, per titolo. */
export function listTemplates(u: Viewer | null) {
	return getDb()
		.select({ slug: pages.slug, title: pages.title, icon: pages.icon, fields: pages.fields, session: pages.session })
		.from(pages)
		.where(and(visibleTo(u), eq(pages.kind, 'template')))
		.orderBy(sql`${pages.title} COLLATE NOCASE`, pages.id)
		.all()
		.map((r) => ({ slug: r.slug, title: r.title, icon: r.icon, fields: (r.fields ?? []).filter((f) => f.image === undefined).map((f) => f.label), session: !!r.session }));
}

export function getTemplatePage(slug: string, u: Viewer | null): PageRow | undefined {
	const p = getPageBySlug(slug);
	return p && p.kind === 'template' && canView(p, u) ? p : undefined;
}

/**
 * La fotocopia di un template: blocchi, colonna a lato e icona; se è un template di resoconti, anche i dati
 * di sessione (con la data di oggi). I segreti restano solo per il Master.
 */
export function templateCopy(tpl: PageRow, u: Viewer, today: string) {
	const doc = isDoc(tpl.content) ? tpl.content : EMPTY_DOC;
	return {
		content: isMaster(u) ? doc : stripSecrets(doc),
		fields: (tpl.fields ?? []).map((f) => ({ ...f })),
		icon: tpl.icon,
		session: tpl.session ? { number: null, realDate: today, world: null } : null,
		template: tpl.slug
	};
}

/** La cartella dei template (la crea se manca). */
function templateFolder(locale: string): number {
	const name = translate(locale, 'kinds.folder.template');
	return (getCategoryBySlug(slugify(name, 'folder')) ?? createCategory(name, null)).id;
}

function createTemplatePage(tp: TemplateData, origin: string | null, categoryId: number | null, u: Viewer): PageRow {
	return createPage(
		{
			kind: 'template',
			title: tp.name,
			content: tp.content,
			fields: tp.fields.map((label): PageField => ({ label, value: '' })),
			session: tp.session ? SESSION_TEMPLATE : null,
			icon: tp.icon,
			template: origin,
			visibility: 'players',
			playersCanEdit: false,
			categoryId,
			tags: []
		},
		u
	);
}

function createHomePage(u: Viewer): PageRow {
	const page = createPage(
		{ title: currentCampaign().name, content: EMPTY_DOC, visibility: 'public', playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null },
		u
	);
	saveCampaign(campaignId(), { homePageId: page.id });
	return page;
}

/**
 * La home è una pagina come le altre, si modifica dalla sua matita. Se manca (wiki nate prima di questa
 * versione, oppure finita nel cestino quando si poteva) la crea il primo Master o Admin che apre la home.
 */
export function homePage(u: Viewer | null): PageRow | null {
	const id = currentCampaign().homePageId;
	const page = id ? getPageById(id) : undefined;
	if (page) return page;
	return u && isMaster(u) ? createHomePage(u) : null;
}

/** La home è una sola: quella di prima torna una pagina come le altre. Sta alla radice, con le pagine annidate dentro di lei. */
export function setHomePage(id: number) {
	saveCampaign(campaignId(), { homePageId: id });
	getDb().update(pages).set({ categoryId: null, parentPageId: null }).where(eq(pages.id, id)).run();
	syncBranch(id, null);
}

/**
 * Le pagine di partenza di una campagna nuova, nella sua lingua: la home, i template preinstallati nella cartella Template
 * e le due cronologie (del mondo e della campagna).
 */
export function seedWiki(locale: string, u: Viewer) {
	const t = (k: string) => translate(locale, k);
	getDb().transaction(() => {
		createHomePage(u);
		const folder = templateFolder(locale);
		for (const id of BUILTIN_TEMPLATES) createTemplatePage(builtinTemplate(id, locale), `b:${id}`, folder, u);
		for (const mode of TIMELINE_MODES)
			createPage(
				{
					kind: 'timeline',
					title: t(`timeline.${mode}`),
					content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t(`timeline.${mode}Intro`) }] }] },
					visibility: 'public',
					playersCanEdit: false,
					categoryId: null,
					tags: [],
					fields: [],
					session: null
				},
				u,
				(p) => setTimelineMode(p.id, mode)
			);
	});
}

/** Una campagna nuova, già pronta per il suo Master: pagine di partenza e template dei plugin accesi. */
export function newCampaign(name: string, master: Viewer, locale: string): CampaignRow {
	const c = insertCampaign(name, master.id);
	inCampaign(c, () => {
		seedWiki(locale, master);
		for (const p of enabledPlugins()) installPluginTemplates(p.id, locale, master);
	});
	return c;
}

/**
 * Accendendo un plugin, i suoi template diventano pagine della cartella Template (una volta sola: se una pagina
 * viene da quel template, anche nel cestino, non se ne crea un'altra). Da lì sono pagine della wiki come le altre.
 */
export function installPluginTemplates(pluginId: string, locale: string, u: Viewer): number {
	const list = pluginTemplates().filter((t) => t.key.startsWith(`p:${pluginId}:`));
	let added = 0;
	getDb().transaction(() => {
		for (const tp of list) {
			const done = getDb().select({ id: pages.id }).from(pages).where(and(ofCampaign(pages), eq(pages.kind, 'template'), eq(pages.template, tp.key))).get();
			if (done) continue;
			createTemplatePage({ name: tp.name, fields: tp.fields, content: tp.content, session: tp.session, icon: null }, tp.key, templateFolder(locale), u);
			added++;
		}
	});
	return added;
}

/** Un template di un pacchetto mondo della 0.10 e precedenti (templates.json): diventa una pagina template. */
export function importTemplate(tp: { name: string; fields: string[]; content: DocNode; session: boolean }, locale: string, u: Viewer): PageRow {
	return createTemplatePage({ ...tp, icon: null }, null, templateFolder(locale), u);
}
