import { describe, expect, it } from 'vitest';
import { compareVersions } from './version.ts';

describe('compareVersions', () => {
	it('confronta maggiore, minore e correttiva come numeri', () => {
		expect(compareVersions('0.11.0', '0.11.0')).toBe(0);
		expect(compareVersions('0.11.0', '0.12.0')).toBe(-1);
		expect(compareVersions('0.12.0', '0.11.9')).toBe(1);
		expect(compareVersions('0.9.0', '0.10.0')).toBe(-1);
		expect(compareVersions('1.0.0', '0.99.99')).toBe(1);
		expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
		expect(compareVersions('1.2.3+build.5', '1.2.3')).toBe(0);
	});

	it('una pre-release viene prima della versione vera', () => {
		expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(-1);
		expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
		expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10')).toBe(-1);
		expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
		expect(compareVersions('1.0.0-alpha.beta', '1.0.0-alpha.1')).toBe(1);
		expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
	});

	it('null se non è una versione', () => {
		expect(compareVersions('', '1.0.0')).toBeNull();
		expect(compareVersions('1.0', '1.0.0')).toBeNull();
		expect(compareVersions('1.0.0', '<html>')).toBeNull();
	});
});
