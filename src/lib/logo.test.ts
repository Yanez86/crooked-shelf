import { describe, expect, it } from 'vitest';
import { AUTO_THEMES, THEMES } from './themes.ts';
import { faviconHref } from './logo.ts';

const svgOf = (href: string) => decodeURIComponent(href.replace('data:image/svg+xml,', ''));

describe('icona della scheda', () => {
	it('ha i colori del tema scelto: fondo principale, libri sopra', () => {
		const neon = THEMES.find((t) => t.id === 'neon')!;
		const svg = svgOf(faviconHref('neon', THEMES));
		expect(svg).toContain(`fill="${neon.colors.primary}"`);
		expect(svg).toContain(`fill="${neon.colors.onPrimary}"`);
		expect(svg).not.toContain('@media');
	});
	it('con «Automatico» segue il sistema: Aria o Aria di notte', () => {
		const svg = svgOf(faviconHref('auto', THEMES));
		const [light, dark] = [AUTO_THEMES.light, AUTO_THEMES.dark].map((id) => THEMES.find((t) => t.id === id)!.colors);
		expect(svg).toContain(`fill="${light.primary}"`);
		expect(svg).toContain(`@media (prefers-color-scheme: dark){.b{fill:${dark.primary}}.f{fill:${dark.onPrimary}}}`);
	});
	it('un tema che non c\'è più ricade su «Automatico»', () => {
		expect(faviconHref('custom-99', THEMES)).toBe(faviconHref('auto', THEMES));
	});
});
