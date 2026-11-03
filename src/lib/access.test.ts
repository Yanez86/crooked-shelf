import { describe, expect, it } from 'vitest';
import { canEdit, canView, canManage, canWrite, isAdmin, isMaster, type PageAccessInfo } from './access.ts';
import { canCreateKind } from './pageKinds.ts';

// Un Admin che in questa campagna è giocatore (vedi roleIn): amministra il sito, ma qui non ha poteri in più.
const admin = { id: 1, role: 'player' as const, admin: true };
const master = { id: 2, role: 'master' as const };
const alice = { id: 3, role: 'player' as const };
const bob = { id: 4, role: 'player' as const };

const page = (o: Partial<PageAccessInfo> = {}): PageAccessInfo => ({
	visibility: 'players',
	authorId: 2,
	playersCanEdit: false,
	hasSecret: false,
	...o
});

describe('permessi', () => {
	it('visibilità', () => {
		expect(canView(page({ visibility: 'public' }), null)).toBe(true);
		expect(canView(page(), null)).toBe(false);
		expect(canView(page(), alice)).toBe(true);
		expect(canView(page({ visibility: 'master' }), alice)).toBe(false);
		expect(canView(page({ visibility: 'master' }), master)).toBe(true);
		expect(canView(page({ visibility: 'personal', authorId: 3 }), alice)).toBe(true);
		expect(canView(page({ visibility: 'personal', authorId: 3 }), bob)).toBe(false);
		expect(canView(page({ visibility: 'personal', authorId: 3 }), admin)).toBe(false);
	});
	it("l'Admin non vede i segreti di una campagna in cui non è Master", () => {
		expect(isAdmin(admin)).toBe(true);
		expect(isMaster(admin)).toBe(false);
		expect(canView(page({ visibility: 'master' }), admin)).toBe(false);
		expect(canEdit(page({ hasSecret: true, playersCanEdit: true }), admin)).toBe(false);
		expect(canManage(page({ hasSecret: true }), admin)).toBe(false);
		// Nella campagna che tiene è il Master.
		expect(canView(page({ visibility: 'master' }), { ...admin, role: 'master' })).toBe(true);
		expect(isAdmin(master)).toBe(false);
	});
	it('modifica', () => {
		expect(canEdit(page(), alice)).toBe(false);
		expect(canEdit(page({ playersCanEdit: true }), alice)).toBe(true);
		expect(canEdit(page({ authorId: 3 }), alice)).toBe(true);
		expect(canEdit(page({ authorId: 3, hasSecret: true }), alice)).toBe(false);
		expect(canEdit(page({ hasSecret: true }), master)).toBe(true);
		expect(canManage(page({ playersCanEdit: true }), alice)).toBe(false);
		expect(canManage(page({ authorId: 3 }), alice)).toBe(true);
	});
	it('vista giocatore: il Master è un giocatore qualunque, e guarda soltanto', () => {
		// Come lo lascia hooks.server.ts: stesso id, ruolo da giocatore.
		const asPlayer = { id: 2, role: 'player' as const, asPlayer: true };
		const mine = page({ visibility: 'public', authorId: 2 });
		// La home e le altre pagine che ha scritto lui: un giocatore non le modifica, e lui neanche.
		expect(canEdit(mine, master)).toBe(true);
		expect(canEdit(mine, asPlayer)).toBe(false);
		expect(canManage(mine, asPlayer)).toBe(false);
		expect(canView(mine, asPlayer)).toBe(true);
		// Le sue pagine personali un giocatore non le vede.
		expect(canView(page({ visibility: 'personal', authorId: 2 }), master)).toBe(true);
		expect(canView(page({ visibility: 'personal', authorId: 2 }), asPlayer)).toBe(false);
		// Non si scrive niente, neanche dove i giocatori potrebbero.
		expect(canEdit(page({ playersCanEdit: true }), asPlayer)).toBe(false);
		expect(canWrite(asPlayer)).toBe(false);
		expect(canCreateKind('page', asPlayer)).toBe(false);
		expect(canWrite(alice)).toBe(true);
		expect(canCreateKind('page', alice)).toBe(true);
	});
});
