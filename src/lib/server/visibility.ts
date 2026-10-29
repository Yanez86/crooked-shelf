import { sql, type SQL } from 'drizzle-orm';
import { schema } from './db/index.ts';
import { isMaster, type Viewer } from '../access.ts';

const { pages } = schema;

/** Condizione SQL: pagine non eliminate che chi legge può vedere (stessa regola di canView). */
export function visibleTo(u: Viewer | null): SQL {
	const alive = sql`${pages.deletedAt} IS NULL`;
	if (!u) return sql`${alive} AND ${pages.visibility} = 'public'`;
	const shared = isMaster(u) ? sql`('public','players','master')` : sql`('public','players')`;
	return sql`${alive} AND (${pages.visibility} IN ${shared} OR (${pages.visibility} = 'personal' AND ${pages.authorId} = ${u.id}))`;
}
