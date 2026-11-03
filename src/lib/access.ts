import type { Role, Visibility } from './roles.ts';

export type { Role, Visibility };

export interface Viewer {
	id: number;
	role: Role;
	/** Vista giocatore: il Master guarda la wiki come un giocatore qualunque (vedi hooks.server.ts). */
	asPlayer?: boolean;
}

export interface PageAccessInfo {
	visibility: Visibility;
	authorId: number | null;
	playersCanEdit: boolean;
	hasSecret: boolean;
}

/** Master e Admin vedono e scrivono i contenuti segreti. */
export const isMaster = (u: Viewer | null | undefined) => u?.role === 'admin' || u?.role === 'master';
export const isAdmin = (u: Viewer | null | undefined) => u?.role === 'admin';

/**
 * Chi conta come autore. Nella vista giocatore nessuno: il Master è un giocatore qualunque, che non ha scritto
 * niente, quindi non vede le sue pagine personali e non ha i diritti di chi le ha scritte (0 non è l'id di nessuno).
 */
export const authorKey = (u: Viewer) => (u.asPlayer ? 0 : u.id);

/** La vista giocatore è solo da guardare: non si crea, non si modifica e non si sposta niente. */
export const canWrite = (u: Viewer | null | undefined): u is Viewer => !!u && !u.asPlayer;

/** Visibilità che un utente può assegnare a una pagina. */
export function allowedVisibilities(u: Viewer | null): Visibility[] {
	if (!u) return [];
	return isMaster(u) ? ['public', 'players', 'master', 'personal'] : ['public', 'players', 'personal'];
}

export function canView(p: PageAccessInfo, u: Viewer | null): boolean {
	switch (p.visibility) {
		case 'public':
			return true;
		case 'players':
			return !!u;
		case 'master':
			return isMaster(u);
		case 'personal':
			return !!u && p.authorId === authorKey(u);
	}
}

export function canEdit(p: PageAccessInfo, u: Viewer | null): boolean {
	if (!canWrite(u) || !canView(p, u)) return false;
	if (isMaster(u)) return true;
	// Un giocatore non modifica pagine con segreti che non può vedere.
	if (p.hasSecret) return false;
	return p.authorId === u.id || p.playersCanEdit;
}

/** Cambiare visibilità e permessi: Master/Admin o l'autore. */
export function canManage(p: PageAccessInfo, u: Viewer | null): boolean {
	return canWrite(u) && (isMaster(u) || (p.authorId === u.id && !p.hasSecret));
}
