import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Fase 3: regole, versioni e cestino, bacheche, editor dei temi. Usa la wiki dei test precedenti.
test.describe.configure({ mode: 'serial' });

const SHOTS = 'test-results/screens';
const ADMIN = { user: 'davide', pass: 'drago-rosso-2024' };
const PLAYER = { user: 'alice', pass: 'elfa-dei-boschi-99' };

let admin: Page;

async function axe(page: Page, label: string) {
	const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
	const found = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
	expect(found, found.join('\n')).toEqual([]);
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function login(browser: Browser, u: { user: string; pass: string }) {
	const page = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await page.goto('/login');
	await page.getByLabel('Nome utente').fill(u.user);
	await page.getByLabel('Password').fill(u.pass);
	await page.getByRole('button', { name: 'Accedi' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
	return page;
}

test('accesso', async ({ browser }) => {
	admin = await login(browser, ADMIN);
});

test('riferimenti alle regole con anteprima SRD', async () => {
	await admin.goto('/wiki/locanda-del-grifone/edit');
	const editor = admin.locator('.editor-content');
	await editor.locator('p').first().click();
	await admin.keyboard.press('End');
	await admin.keyboard.type(' Il cuoco lancia @firebal');
	const option = admin.getByRole('option', { name: /^Fireball — Incantesimo/ });
	await expect(option).toBeVisible();
	await admin.keyboard.press('Enter');
	await admin.keyboard.type('se lo fai @condizione[Prone|cadere prono] ');
	await expect(editor.locator('.ruleref')).toHaveCount(2);
	await admin.getByRole('button', { name: 'Salva' }).click();

	const content = admin.locator('.content');
	await expect(content.getByRole('link', { name: /^Fireball/ })).toHaveAttribute('href', 'https://www.dndbeyond.com/search?q=Fireball');
	await expect(content.getByRole('link', { name: /^cadere prono/ })).toBeVisible();

	const info = content.getByRole('button', { name: 'Anteprima: Fireball' });
	await info.click();
	const dialog = admin.getByRole('dialog', { name: 'Fireball' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Level 3 Evocation');
	await expect(dialog).toContainText('8d6');
	await expect(dialog.getByRole('heading', { name: 'Fireball' })).toBeFocused();
	await expect(info).toHaveAttribute('aria-expanded', 'true');
	await axe(admin, 'anteprima regola');
	await shot(admin, '20-anteprima-regola');
	await admin.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(info).toBeFocused();
});

test('pagina delle regole', async () => {
	await admin.goto('/rules');
	await axe(admin, 'regole');
	await admin.getByLabel('Nome (in inglese)').fill('goblin');
	await admin.getByRole('button', { name: 'Cerca' }).last().click();
	await expect(admin.getByRole('link', { name: /^Goblin/ }).first()).toBeVisible();

	await admin.goto('/rules/spell/fireball');
	await expect(admin.getByRole('heading', { level: 1, name: 'Fireball' })).toBeVisible();
	await expect(admin.getByRole('region', { name: 'Citata in:' })).toContainText('Locanda del Grifone');
	await expect(admin.locator('main')).toContainText('System Reference Document 5.2');
	await axe(admin, 'regola');
});

test('cronologia delle modifiche e ripristino', async () => {
	await admin.goto('/wiki/locanda-del-grifone');
	await admin.getByRole('link', { name: 'Cronologia delle modifiche' }).click();
	const versions = admin.locator('.rev');
	await expect(versions.nth(1)).toBeVisible();
	await expect(versions.first()).toContainText('attuale');

	await versions.first().getByRole('link', { name: /Cosa è cambiato/ }).click();
	const diff = admin.getByRole('region', { name: /Cosa è cambiato/ });
	await expect(diff.locator('ins').first()).toContainText('Fireball');
	await axe(admin, 'confronto versioni');
	await shot(admin, '21-confronto-versioni');

	await admin.locator('.rev').nth(1).getByRole('button', { name: /Ripristina/ }).click();
	await expect(admin.getByRole('status').first()).toContainText('Versione ripristinata');
	await expect(admin.locator('.content')).not.toContainText('Fireball');
	await expect(admin.locator('.content .secret')).toContainText('spia');
});

test('cestino', async () => {
	await admin.goto('/wiki/new?template=none');
	await admin.getByLabel('Titolo', { exact: true }).fill('Pagina da cestinare');
	await admin.locator('.editor-content').click();
	await admin.keyboard.type('Testo che sparirà.');
	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await admin.getByRole('link', { name: /Modifica/ }).click();
	await admin.getByRole('checkbox', { name: /Sì, voglio eliminare/ }).check();
	await admin.getByRole('button', { name: 'Elimina la pagina' }).click();
	await admin.getByRole('link', { name: /nel cestino/ }).click();

	await expect(admin.locator('main')).toContainText('Pagina da cestinare');
	await axe(admin, 'cestino');
	await admin.getByRole('button', { name: /^Recupera ?: Pagina da cestinare$/ }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Pagina da cestinare' })).toBeVisible();
	await admin.goto('/search?q=sparirà');
	await expect(admin.getByRole('link', { name: 'Pagina da cestinare' })).toBeVisible();

	await admin.goto('/wiki/pagina-da-cestinare/edit');
	await admin.getByRole('checkbox', { name: /Sì, voglio eliminare/ }).check();
	await admin.getByRole('button', { name: 'Elimina la pagina' }).click();
	await admin.goto('/trash');
	await admin.getByRole('checkbox', { name: /Sono sicuro/ }).check();
	await admin.getByRole('button', { name: /^Elimina per sempre ?: Pagina da cestinare$/ }).click();
	await expect(admin.getByRole('status').first()).toContainText('eliminata per sempre');
	await expect(admin.locator('main')).toContainText('Il cestino è vuoto');
});

test('bacheche', async ({ browser }) => {
	await admin.goto('/boards');
	await axe(admin, 'bacheche');
	await admin.getByLabel('Titolo').fill('Missioni del gruppo');
	await admin.getByRole('radio', { name: /Del gruppo/ }).check();
	await admin.getByRole('button', { name: 'Crea la bacheca' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Missioni del gruppo' })).toBeVisible();

	const col = (name: string) => admin.getByRole('listitem').filter({ has: admin.getByRole('heading', { level: 2, name: new RegExp(`^${name}`) }) });
	await col('Indizi').getByText('+ Aggiungi scheda').click();
	await col('Indizi').getByLabel('Titolo').fill('Chi è il cuoco?');
	await col('Indizi').getByLabel('Testo').fill('Lavora alla [[Locanda del Grifone]]. Conosce @incantesimo[Fireball].');
	await col('Indizi').getByRole('button', { name: 'Aggiungi scheda' }).click();
	const card = admin.getByRole('article', { name: 'Chi è il cuoco?' });
	await expect(card.getByRole('link', { name: 'Locanda del Grifone' })).toBeVisible();
	await expect(card.getByRole('button', { name: 'Anteprima: Fireball' })).toBeVisible();

	// Spostamento da tastiera: il focus resta sul pulsante.
	await card.getByRole('button', { name: /Sposta nella colonna a destra/ }).click();
	await expect(col('Domande').getByRole('article', { name: 'Chi è il cuoco?' })).toBeVisible();
	await expect(admin.getByRole('button', { name: 'Sposta nella colonna a destra: Chi è il cuoco?' })).toBeFocused();

	await col('Domande').getByText('+ Aggiungi scheda').click();
	await col('Domande').getByLabel('Titolo').fill('Dove dorme il drago?');
	await col('Domande').getByRole('button', { name: 'Aggiungi scheda' }).click();
	await expect(col('Domande').getByRole('article')).toHaveCount(2);

	// Trascinamento.
	await admin.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
	await admin.getByRole('article', { name: 'Dove dorme il drago?' }).dragTo(col('Risolto').getByRole('heading', { level: 2 }));
	await expect(col('Risolto').getByRole('article', { name: 'Dove dorme il drago?' })).toBeVisible();

	await axe(admin, 'bacheca');
	await shot(admin, '22-bacheca');
	await admin.setViewportSize({ width: 390, height: 844 });
	await shot(admin, '23-bacheca-telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });
	const boardUrl = admin.url();

	// Bacheca personale dell'Admin: il giocatore non la vede.
	await admin.goto('/boards');
	await admin.getByLabel('Titolo').fill('Idee segrete');
	await admin.getByRole('radio', { name: /Personale/ }).check();
	await admin.getByRole('button', { name: 'Crea la bacheca' }).click();
	const personalUrl = admin.url();

	const p = await login(browser, PLAYER);
	await p.goto('/boards');
	await expect(p.locator('main')).toContainText('Missioni del gruppo');
	await expect(p.locator('main')).not.toContainText('Idee segrete');
	expect((await p.goto(personalUrl))?.status()).toBe(404);
	await p.goto(boardUrl);
	await expect(p.getByRole('article', { name: 'Chi è il cuoco?' })).toBeVisible();
	await expect(p.getByRole('heading', { name: 'Gestisci la bacheca' })).toHaveCount(0);
	await p.context().close();
});

test('editor dei temi', async () => {
	await admin.goto('/admin/themes');
	await axe(admin, 'temi');
	await admin.getByRole('link', { name: /^Copia e modifica ?: Chiaro$/ }).click();
	await admin.getByLabel('Nome', { exact: true }).fill('Tema Arcano');

	// Un colore principale troppo chiaro rende illeggibile il testo dei pulsanti.
	await admin.getByLabel(/^Colore principale/).fill('#dddddd');
	await expect(admin.locator('p.summary')).toContainText('contrasti insufficienti');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('alert')).toContainText('non sarebbero leggibili');

	await admin.getByLabel(/^Colore principale/).fill('#4a1a7a');
	await expect(admin.locator('p.summary')).toContainText('il tema si può salvare');
	await axe(admin, 'editor temi');
	await shot(admin, '24-editor-temi');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('status').first()).toContainText('Modifiche salvate');

	// Il tema compare nelle preferenze.
	await admin.goto('/preferences');
	await admin.getByRole('radio', { name: 'Tema Arcano' }).check();
	await admin.getByRole('button', { name: 'Salva' }).first().click();
	await expect(admin.locator('html')).toHaveAttribute('data-theme', 'custom-1');
	await admin.goto('/wiki/locanda-del-grifone');
	await axe(admin, 'tema personalizzato');

	// Esporta e reimporta.
	const res = await admin.request.get('/admin/themes/custom-1/export');
	const json = await res.json();
	expect(json).toMatchObject({ format: 'crooked-shelf-theme', name: 'Tema Arcano', scheme: 'light' });
	await admin.goto('/admin/themes');
	await admin.getByLabel('File del tema (.json)').setInputFiles({ name: 'arcano.theme.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
	await admin.getByRole('button', { name: 'Importa un tema' }).click();
	await expect(admin.getByRole('status').first()).toContainText('Tema importato');

	// Un tema illeggibile viene rifiutato anche se importato.
	await admin.goto('/admin/themes');
	const bad = { ...json, colors: { ...json.colors, text: '#fbfaf8' } };
	await admin.getByLabel('File del tema (.json)').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
	await admin.getByRole('button', { name: 'Importa un tema' }).click();
	await expect(admin.getByRole('alert')).toContainText('non sarebbero leggibili');

	// Torna al tema chiaro per i test successivi.
	await admin.goto('/preferences');
	await admin.getByRole('radio', { name: 'Chiaro', exact: true }).check();
	await admin.getByRole('button', { name: 'Salva' }).first().click();
});
