import { describe, expect, it } from 'vitest';
import { getRule, hasRule, ruleHtml, searchRules } from './index.ts';

describe('SRD 5.2', () => {
	it('trova incantesimi, mostri e condizioni', () => {
		expect(getRule('spell', 'fireball')?.n).toBe('Fireball');
		expect(getRule('condition', 'prone')?.t).toContain('Prone');
		expect(hasRule('monster', 'aboleth')).toBe(true);
		expect(searchRules('fire', 'spell', 3)[0].n).toMatch(/^Fire/);
	});
	it('testo in HTML sicuro', () => {
		const html = ruleHtml({ k: 'spell', i: 'x', n: 'X', s: '', t: '**Range:** 60 feet\n<script>' });
		expect(html).toBe('<p><strong>Range:</strong> 60 feet</p><p>&lt;script&gt;</p>');
	});
});
