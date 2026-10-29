import type { SessionUser } from '#lib/server/auth.ts';
import type { Prefs } from '#lib/prefs.ts';

declare global {
	const __APP_VERSION__: string;
	namespace App {
		interface Locals {
			user: SessionUser | null;
			prefs: Prefs;
			locale: string;
		}
	}
}

export {};
