import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { useMemoryDb } from './db/index.ts';
import { resetSettingsCache } from './settings.ts';
import { allPlugins, enabledPlugins, extraThemes, pluginCalendars, reloadPlugins, setPluginEnabled } from './plugins.ts';
import { getTemplate, listTemplates } from './templates.ts';
import { getRule, hasRule } from './rules/index.ts';
import { isLocale, translate } from '../i18n/index.ts';

beforeEach(() => {
	useMemoryDb();
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
		expect(listTemplates('it').some((t) => t.name === 'Taverna')).toBe(false);
	});

	it('acceso: temi, template, calendari e regole', () => {
		setPluginEnabled('esempio-gotico', true);
		expect(extraThemes().map((t) => t.name)).toEqual(['Gotico']);
		const tpl = listTemplates('it').find((t) => t.name === 'Taverna')!;
		expect(getTemplate(tpl.key, 'it')?.fields).toContain('Oste');
		expect(pluginCalendars()[0].calendar.months).toHaveLength(13);
		expect(hasRule('rule', 'riposo-in-taverna')).toBe(true);
		expect(getRule('rule', 'riposo-in-taverna')?.src).toBe('Esempio: atmosfera gotica');
		setPluginEnabled('esempio-gotico', false);
		expect(hasRule('rule', 'riposo-in-taverna')).toBe(false);
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
