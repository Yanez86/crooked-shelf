import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { useMemoryDb, schema } from './db/index.ts';
import { resetSettingsCache } from './settings.ts';
import { allPlugins, enabledPlugins, extraThemes, pluginCalendars, reloadPlugins, setPluginEnabled } from './plugins.ts';
import { installPluginTemplates, listTemplates } from './templates.ts';
import { getPageBySlug } from './pages.ts';
import { getRule, hasRule } from './rules/index.ts';
import { isLocale, translate } from '../i18n/index.ts';
import { ruleLinks } from '../rules/index.ts';

const admin = { id: 1, role: 'admin' as const };

beforeEach(() => {
	useMemoryDb().insert(schema.users).values({ id: 1, username: 'a', displayName: 'A', passwordHash: 'x', role: 'admin', createdAt: 0 }).run();
	resetSettingsCache();
	// Plugin finti in una cartella temporanea, insieme all'esempio incluso.
	const dir = mkdtempSync(join(tmpdir(), 'cs-plugins-'));
	process.env.CS_DATA_DIR = dir;
	const p = join(dir, 'plugins', 'lingua-test');
	mkdirSync(p, { recursive: true });
	writeFileSync(join(p, 'plugin.json'), JSON.stringify({ id: 'lingua-test', name: 'Lingua di prova', description: 'Scopo.', instructions: 'Istruzioni.', contributes: { locales: { es: 'es.json' }, themes: ['../../evil.json', 'brutto.json'] } }));
	writeFileSync(join(p, 'es.json'), JSON.stringify({ _meta: { name: 'Español' }, nav: { home: 'Inicio' } }));
	writeFileSync(join(p, 'brutto.json'), JSON.stringify({ name: 'Illeggibile', scheme: 'light', colors: { bg: '#ffffff' } }));
	reloadPlugins();
});

describe('plugin', () => {
	it('trova i plugin, spenti di default', () => {
		expect(allPlugins().map((p) => p.id).sort()).toEqual(['dndbeyond', 'esempio-gotico', 'lingua-test']);
		expect(enabledPlugins()).toEqual([]);
		expect(installPluginTemplates('esempio-gotico', 'it', admin)).toBe(0);
		expect(listTemplates(admin)).toEqual([]);
	});

	it('acceso: temi, template, calendari e regole', () => {
		setPluginEnabled('esempio-gotico', true);
		expect(extraThemes().map((t) => t.name)).toEqual(['Gotico']);
		// I template del plugin diventano pagine della cartella Template, una volta sola.
		expect(installPluginTemplates('esempio-gotico', 'it', admin)).toBe(1);
		expect(installPluginTemplates('esempio-gotico', 'it', admin)).toBe(0);
		expect(listTemplates(admin).find((t) => t.title === 'Taverna')?.fields).toContain('Oste');
		expect(getPageBySlug('taverna')).toMatchObject({ kind: 'template', template: 'p:esempio-gotico:0' });
		expect(pluginCalendars()[0].calendar.months).toHaveLength(13);
		expect(hasRule('rule', 'riposo-in-taverna')).toBe(true);
		expect(getRule('rule', 'riposo-in-taverna')?.src).toBe('Esempio: atmosfera gotica');
		setPluginEnabled('esempio-gotico', false);
		expect(hasRule('rule', 'riposo-in-taverna')).toBe(false);
		// Spento il plugin, il template resta: ormai è una pagina della wiki.
		expect(listTemplates(admin).map((t) => t.title)).toEqual(['Taverna']);
	});

	it('lingue aggiuntive, e niente file fuori dalla cartella del plugin', () => {
		const p = allPlugins().find((x) => x.id === 'lingua-test')!;
		expect(p.warnings.length).toBe(2);
		expect(p.themes).toEqual([]);
		expect(isLocale('es')).toBe(false);
		setPluginEnabled('lingua-test', true);
		expect(isLocale('es')).toBe(true);
		expect(translate('es', 'nav.home')).toBe('Inicio');
		// Le chiavi mancanti ricadono sull'inglese.
		expect(translate('es', 'nav.pages')).toBe('Pages');
	});

	it('link a siti esterni: D&D Beyond è un plugin come gli altri', () => {
		expect(ruleLinks('Fireball')).toEqual([]);
		setPluginEnabled('dndbeyond', true);
		expect(ruleLinks(' Mage Armor ')).toEqual([{ site: 'D&D Beyond', url: 'https://www.dndbeyond.com/search?q=Mage%20Armor' }]);
		setPluginEnabled('dndbeyond', false);
		expect(ruleLinks('Fireball')).toEqual([]);
	});

	it('link non validi: ignorati e segnalati', () => {
		const p = join(process.env.CS_DATA_DIR!, 'plugins', 'link-test');
		mkdirSync(p);
		writeFileSync(join(p, 'plugin.json'), JSON.stringify({ id: 'link-test', description: 'Scopo.', instructions: 'Istruzioni.', contributes: { links: ['js.json', 'fisso.json'] } }));
		writeFileSync(join(p, 'js.json'), JSON.stringify({ site: 'X', url: 'javascript:alert(1)//{name}' }));
		writeFileSync(join(p, 'fisso.json'), JSON.stringify({ site: 'X', url: 'https://example.com/' }));
		reloadPlugins();
		const found = allPlugins().find((x) => x.id === 'link-test')!;
		expect(found.links).toEqual([]);
		expect(found.warnings).toHaveLength(2);
	});

	it('ogni plugin dice a cosa serve e come si usa: se manca, viene segnalato', () => {
		const p = join(process.env.CS_DATA_DIR!, 'plugins', 'muto');
		mkdirSync(p);
		writeFileSync(join(p, 'plugin.json'), JSON.stringify({ id: 'muto' }));
		reloadPlugins();
		expect(allPlugins().find((x) => x.id === 'muto')!.warnings).toEqual(['plugin.json: description', 'plugin.json: instructions']);
		for (const id of ['dndbeyond', 'esempio-gotico']) {
			const included = allPlugins().find((x) => x.id === id)!;
			expect(included.warnings).toEqual([]);
			expect(included.instructions).toContain('Accendi');
		}
	});
});
