import type { PageServerLoad } from './$types';
import { listAudit } from '#lib/server/audit.ts';

/** Il registro delle azioni che contano per la sicurezza: le ultime 300. */
export const load: PageServerLoad = () => ({ rows: listAudit(300) });
