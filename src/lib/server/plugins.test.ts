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

const admin = { id: 1, role: 'admin' as const };

beforeEach(() => {
	useMemoryDb().insert(schema.users).values({ id: 1, username: 'a', displayName: 'A', passwordHash: 'x', role: 'admin', createdAt: 0 }).run();
	resetSettingsCache();
	// Plugin finti in una cartella temporanea, insieme all'esempio incluso.
	const dir = mkdtempSync(join(tmpdir(), 'cs-plugins-'));
	process.env.CS_DATA_DIR = dir;
	const p = join(dir, 'plugins', 'lingua-test');
	mkdirSync(p, { recursive: true });
	writeFileSync(join(p, 'plugin.json'), JSON.stringify({ id: 'lingua-test', name: 'Lingua di prova', contributes: { locales: { es: 'es.json' }, themes: ['../../evil.json', 'brutto.json'] } }));
	writeFileSync(join(p, 'es.json'), JSON.stringify({ _meta: { name: 'Español' }, nav: { home: 'Inicio' } }));
	writeFileSync(join(p, 'brutto.json'), JSON.stringify({ name: 'Illeggibile', scheme: 'light', colors: { bg: '#ffffff' } }));
	reloadPlugins();
});

describe('plugin', () => {
	it('trova i plugin, spenti di default', () => {
		expect(allPlugins().map((p) => p.id).sort()).toEqual(['esempio-gotico', 'lingua-test']);
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
});
