import { describe, expect, it } from 'vitest';
import { canEdit, canView, canManage, type PageAccessInfo } from './access.ts';

const admin = { id: 1, role: 'admin' as const };
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
	it('modifica', () => {
		expect(canEdit(page(), alice)).toBe(false);
		expect(canEdit(page({ playersCanEdit: true }), alice)).toBe(true);
		expect(canEdit(page({ authorId: 3 }), alice)).toBe(true);
		expect(canEdit(page({ authorId: 3, hasSecret: true }), alice)).toBe(false);
		expect(canEdit(page({ hasSecret: true }), master)).toBe(true);
		expect(canManage(page({ playersCanEdit: true }), alice)).toBe(false);
		expect(canManage(page({ authorId: 3 }), alice)).toBe(true);
	});
});
