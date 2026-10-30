import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseChangelog } from './changelog.ts';

describe('parseChangelog', () => {
	it('legge versioni, sezioni e voci', () => {
		const r = parseChangelog('# Novità\n\nIntro\n\n## 1.2.0 — 2026-01-02\n\n### Aggiunte\n- Uno\n- Due\n\n### Correzioni\n- Tre\n\n## 1.1.0\n');
		expect(r).toEqual([
			{ version: '1.2.0', date: '2026-01-02', sections: [{ title: 'Aggiunte', items: ['Uno', 'Due'] }, { title: 'Correzioni', items: ['Tre'] }] },
			{ version: '1.1.0', date: '', sections: [] }
		]);
	});

	it('la prima versione del CHANGELOG è quella di package.json', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
		expect(parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))[0].version).toBe(pkg.version);
	});
});
