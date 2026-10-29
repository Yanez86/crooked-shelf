import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { BUILTIN_TEMPLATES, builtinTemplate, type BuiltinTemplate, type TemplateData } from '../templates.ts';
import { EMPTY_DOC, isDoc, type DocNode } from '../content/types.ts';

const { templates } = schema;

function fromRow(r: typeof templates.$inferSelect): TemplateData {
	return {
		key: `c:${r.id}`,
		name: r.name,
		description: r.description,
		fields: r.fields ?? [],
		content: isDoc(r.content) ? r.content : EMPTY_DOC,
		session: r.session,
		builtin: false
	};
}

export function listTemplates(locale: string): TemplateData[] {
	const custom = getDb().select().from(templates).orderBy(asc(templates.name)).all().map(fromRow);
	return [...BUILTIN_TEMPLATES.map((id) => builtinTemplate(id, locale)), ...custom];
}

export function getTemplate(key: string, locale: string): TemplateData | undefined {
	const [kind, id] = key.split(':');
	if (kind === 'b' && BUILTIN_TEMPLATES.includes(id as BuiltinTemplate)) return builtinTemplate(id as BuiltinTemplate, locale);
	if (kind === 'c' && /^\d+$/.test(id)) {
		const r = getDb().select().from(templates).where(eq(templates.id, Number(id))).get();
		return r ? fromRow(r) : undefined;
	}
	return undefined;
}

export interface TemplateInput {
	name: string;
	description: string;
	fields: string[];
	content: DocNode;
	session: boolean;
}

export function saveTemplate(input: TemplateInput, userId: number, id?: number): number {
	const now = Date.now();
	const db = getDb();
	if (id) {
		db.update(templates).set({ ...input, updatedAt: now }).where(eq(templates.id, id)).run();
		return id;
	}
	return db
		.insert(templates)
		.values({ ...input, createdBy: userId, createdAt: now, updatedAt: now })
		.returning({ id: templates.id })
		.get().id;
}

export function deleteTemplate(id: number) {
	getDb().delete(templates).where(eq(templates.id, id)).run();
}

/** Nomi dei campi: uno per riga. */
export function parseFieldNames(raw: string): string[] {
	return raw
		.split('\n')
		.map((s) => s.trim().slice(0, 60))
		.filter(Boolean)
		.slice(0, 30);
}
