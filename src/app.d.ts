import type { SessionUser } from '#lib/server/auth.ts';
import type { CampaignRow } from '#lib/server/campaigns.ts';
import type { Prefs } from '#lib/prefs.ts';

declare global {
	const __APP_VERSION__: string;
	namespace App {
		interface Locals {
			/** `role` è il ruolo nella campagna della richiesta (vedi roleIn). */
			user: SessionUser | null;
			/** La campagna della richiesta; null per chi non ne ha nessuna. */
			campaign: CampaignRow | null;
			/** Le campagne in cui può entrare. */
			campaigns: CampaignRow[];
			prefs: Prefs;
			locale: string;
		}
	}
}

export {};
