import { beforeEach, describe, expect, it } from 'vitest';
import { hashSlot, limited, resetLimits } from './ratelimit.ts';

describe('limiti di frequenza', () => {
	beforeEach(resetLimits);
	it('conta per chiave in una finestra', () => {
		for (let i = 0; i < 3; i++) expect(limited('login', '1.2.3.4', 3, 60_000)).toBe(false);
		expect(limited('login', '1.2.3.4', 3, 60_000)).toBe(true);
		expect(limited('login', '5.6.7.8', 3, 60_000)).toBe(false);
		expect(limited('upload', '1.2.3.4', 3, 60_000)).toBe(false);
	});
	it('il budget degli hash si esaurisce e si ricarica', () => {
		let ok = 0;
		for (let i = 0; i < 100; i++) if (hashSlot()) ok++;
		expect(ok).toBeGreaterThan(20);
		expect(ok).toBeLessThan(40);
		expect(hashSlot()).toBe(false);
	});
});
