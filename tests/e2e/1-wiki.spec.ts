import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

// Un'unica storia, in ordine: configurazione, pagine, invito di un giocatore, permessi, preferenze, accessibilità.
test.describe.configure({ mode: 'serial' });

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

const ADMIN = { user: 'davide', pass: 'drago-rosso-2024' };
const TREE = 'Pagine e risorse';
const PLAYER = { user: 'alice', pass: 'elfa-dei-boschi-99' };

let admin: Page;
let inviteLink = '';

async function axe(page: Page, label: string) {
	const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
	const found = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
	expect(found, found.join('\n')).toEqual([]);
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function newPage(page: Page, title: string, write: (p: Page) => Promise<void>, opts: { visibility?: string; tags?: string; category?: string } = {}) {
	await page.goto('/wiki/new?template=none');
	await page.getByLabel('Titolo', { exact: true }).fill(title);
	const editor = page.locator('.editor-content');
	await editor.click();
	await write(page);
	if (opts.category) await page.getByLabel('Categoria').selectOption({ label: opts.category });
	if (opts.tags) await page.getByLabel('Tag', { exact: true }).fill(opts.tags);
	if (opts.visibility) await page.getByRole('radio', { name: new RegExp(opts.visibility) }).check();
	await page.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

async function login(browser: Browser, u: { user: string; pass: string }) {
	const ctx = await browser.newContext({ locale: 'it-IT' });
	const page = await ctx.newPage();
	await page.goto('/login');
	await page.getByLabel('Nome utente').fill(u.user);
	await page.getByLabel('Password').fill(u.pass);
	await page.getByRole('button', { name: 'Accedi' }).click();
	return page;
}

test('prima configurazione', async ({ browser }) => {
	admin = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await admin.goto('/');
	await expect(admin).toHaveURL(/\/setup$/);
	await axe(admin, 'setup');
	await shot(admin, '01-setup');

	await admin.getByLabel('Nome della campagna').fill('Le Cronache di Faerûn');
	await admin.getByLabel('Lingua predefinita').selectOption('it');
	await admin.getByLabel('Nome utente').fill(ADMIN.user);
	await admin.getByLabel('Nome visualizzato').fill('Davide');
	await admin.getByLabel('Password', { exact: true }).fill(ADMIN.pass);
	await admin.getByLabel('Ripeti la password').fill(ADMIN.pass);
	await admin.getByRole('button', { name: 'Crea la wiki' }).click();

	await expect(admin.getByRole('heading', { level: 1, name: 'Le Cronache di Faerûn' })).toBeVisible();
	await expect(admin.getByText('La wiki è vuota')).toBeVisible();
	await axe(admin, 'home vuota');
});

test('la configurazione non si può ripetere', async ({ page }) => {
	await page.goto('/setup');
	await expect(page).toHaveURL(/\/login/);
});

test('categorie', async () => {
	await admin.goto('/categories');
	await admin.getByLabel('Nome', { exact: true }).first().fill('Luoghi');
	await admin.getByRole('button', { name: 'Aggiungi' }).click();
	await expect(admin.getByRole('status')).toContainText('Categoria creata');
	await admin.getByLabel('Nome', { exact: true }).first().fill('Città');
	await admin.getByLabel('Dentro la categoria').first().selectOption({ label: 'Luoghi' });
	await admin.getByRole('button', { name: 'Aggiungi' }).click();
	await expect(admin.locator('.tree')).toContainText('Città');
	await axe(admin, 'categorie');
});

test('pagine, collegamenti e segreti', async () => {
	await newPage(admin, 'Bartolo Pancia', async (p) => {
		await p.keyboard.type('Il locandiere più grasso della Costa della Spada.');
	});

	await newPage(
		admin,
		'Locanda del Grifone',
		async (p) => {
			await p.keyboard.type('## Descrizione');
			await p.keyboard.press('Enter');
			await p.keyboard.type('Il proprietario è ');
			await p.keyboard.type('[[Bart');
			const option = p.getByRole('option', { name: 'Bartolo Pancia' });
			await expect(option).toBeVisible();
			await expect(p.locator('.editor-content')).toHaveAttribute('aria-activedescendant', /suggest-/);
			await p.keyboard.press('Enter');
			await p.keyboard.type('e serve birra annacquata. Si parla di [[Drago Rosso]] ');
			await p.keyboard.press('Enter');
			await p.getByRole('button', { name: /Segreto del Master/ }).click();
			await p.keyboard.type('Bartolo è una spia degli Zhentarim.');
		},
		{ tags: 'Taverna, Nord', category: 'Luoghi › Città' }
	);

	const content = admin.locator('.content');
	await expect(content.getByRole('heading', { level: 2, name: 'Descrizione' })).toBeVisible();
	await expect(content.getByRole('link', { name: 'Bartolo Pancia' })).toHaveAttribute('href', '/wiki/bartolo-pancia');
	await expect(content.locator('.wikilink.missing')).toContainText('Drago Rosso');
	await expect(content.locator('.secret')).toContainText('spia degli Zhentarim');
	await expect(admin.getByRole('navigation', { name: 'Percorso della categoria' })).toContainText('Luoghi');
	await expect(admin.getByRole('link', { name: 'Taverna' })).toBeVisible();
	await axe(admin, 'pagina con segreto');
	await shot(admin, '02-pagina');

	// Il collegamento rosso porta alla creazione con il titolo già scritto.
	await content.locator('.wikilink.missing').click();
	await admin.getByRole('link', { name: /Mostro/ }).click();
	await expect(admin.getByLabel('Titolo', { exact: true })).toHaveValue('Drago Rosso');
	await expect(admin.getByLabel('Nome del campo 1')).toHaveValue('Tipo');

	// Backlink.
	await admin.goto('/wiki/bartolo-pancia');
	await expect(admin.getByRole('region', { name: 'Pagine che collegano qui' })).toContainText('Locanda del Grifone');

	await newPage(admin, 'Piano del cattivo', async (p) => {
		await p.keyboard.type('Il drago dorme sotto la locanda.');
	}, { visibility: 'Solo Master' });
});

test('albero delle cartelle e delle pagine', async () => {
	await admin.goto('/wiki/locanda-del-grifone');
	const tree = admin.getByRole('navigation', { name: TREE });
	// Le cartelle della pagina aperta sono già aperte, la pagina è evidenziata.
	const locanda = tree.getByRole('link', { name: 'Locanda del Grifone' });
	await expect(locanda).toHaveAttribute('aria-current', 'page');
	// Le pagine senza categoria stanno alla radice.
	await expect(tree.getByRole('link', { name: 'Bartolo Pancia' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Piano del cattivo' })).toBeVisible();

	// Una cartella si chiude col mouse e si riapre da tastiera.
	const luoghi = tree.locator('summary', { hasText: 'Luoghi' });
	await luoghi.click();
	await expect(locanda).toBeHidden();
	await luoghi.focus();
	await admin.keyboard.press('Enter');
	await expect(locanda).toBeVisible();

	await tree.getByRole('link', { name: 'Bartolo Pancia' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Bartolo Pancia' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Bartolo Pancia' })).toHaveAttribute('aria-current', 'page');
	// Le cartelle aperte restano aperte.
	await expect(locanda).toBeVisible();
	await axe(admin, 'albero');
	await shot(admin, '02b-albero');

	// Sul telefono l'albero sta chiuso in un pulsante.
	await admin.setViewportSize({ width: 390, height: 844 });
	const toggle = admin.getByRole('button', { name: 'Pagine e risorse' });
	await expect(locanda).toBeHidden();
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(locanda).toBeVisible();
	await shot(admin, '02c-albero-telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });
});

test('editor: accessibilità e telefono', async () => {
	await admin.goto('/wiki/locanda-del-grifone/edit');
	await expect(admin.locator('.editor-content')).toContainText('spia');
	await axe(admin, 'editor');
	await shot(admin, '03-editor');
	await admin.setViewportSize({ width: 390, height: 844 });
	await shot(admin, '04-editor-telefono');
	await admin.goto('/wiki/locanda-del-grifone');
	await shot(admin, '05-pagina-telefono');
	await axe(admin, 'pagina telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });
});

test('modifica concorrente non sovrascrive', async ({ browser }) => {
	const other = await login(browser, ADMIN);
	await other.goto('/wiki/bartolo-pancia/edit');
	await admin.goto('/wiki/bartolo-pancia/edit');
	await admin.locator('.editor-content').click();
	await admin.keyboard.type(' Prima modifica.');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.locator('.content')).toContainText('Prima modifica');

	await other.locator('.editor-content').click();
	await other.keyboard.type(' Seconda modifica.');
	await other.getByRole('button', { name: 'Salva' }).click();
	await expect(other.getByRole('alert')).toContainText('Qualcun altro');
	await expect(other.locator('.editor-content')).toContainText('Seconda modifica');
	await other.context().close();
});

test('ricerca', async () => {
	await admin.goto('/search?q=spia');
	await expect(admin.locator('main').getByRole('link', { name: 'Locanda del Grifone' })).toBeVisible();
	await admin.goto('/search?q=locandiere');
	await expect(admin.locator('.hits mark').first()).toBeVisible();
	await axe(admin, 'ricerca');
});

test('invito di un giocatore', async ({ browser }) => {
	await admin.goto('/admin/invites');
	await admin.getByLabel('Ruolo').selectOption('player');
	await admin.getByRole('button', { name: 'Crea invito' }).click();
	inviteLink = await admin.getByLabel('Link di invito').inputValue();
	expect(inviteLink).toMatch(/\/invite\/[\w-]{20,}$/);
	await axe(admin, 'inviti');

	const ctx = await browser.newContext({ locale: 'it-IT' });
	const p = await ctx.newPage();
	await p.goto(inviteLink);
	await expect(p.getByText('invitato come Giocatore')).toBeVisible();
	await p.getByLabel('Nome utente').fill(PLAYER.user);
	await p.getByLabel('Nome visualizzato').fill('Alice');
	await p.getByLabel('Password', { exact: true }).fill(PLAYER.pass);
	await p.getByLabel('Ripeti la password').fill(PLAYER.pass);
	await p.getByRole('button', { name: "Crea l'account" }).click();
	await expect(p.getByText('Bentornato, Alice.')).toBeVisible();

	// L'invito non funziona una seconda volta.
	const p2 = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await p2.goto(inviteLink);
	await expect(p2.getByRole('alert')).toContainText('non è valido');
	await ctx.close();
});

test('il giocatore non vede i segreti', async ({ browser }) => {
	const p = await login(browser, PLAYER);
	await p.goto('/wiki/locanda-del-grifone');
	await expect(p.locator('.content')).toContainText('birra annacquata');
	await expect(p.locator('.content')).not.toContainText('spia');
	await expect(p.getByText('Contiene segreti')).toHaveCount(0);
	await expect(p.getByRole('link', { name: /Modifica/ })).toHaveCount(0);

	await expect(p.getByRole('navigation', { name: TREE })).toContainText('Bartolo Pancia');
	await expect(p.getByRole('navigation', { name: TREE })).not.toContainText('Piano del cattivo');

	const r = await p.goto('/wiki/piano-del-cattivo');
	expect(r?.status()).toBe(404);
	const e = await p.goto('/wiki/locanda-del-grifone/edit');
	expect(e?.status()).toBe(404);

	await p.goto('/search?q=spia');
	await expect(p.getByRole('status')).toContainText('0 risultati');
	await p.goto('/search?q=dorme');
	await expect(p.locator('.hits')).toHaveCount(0);

	const s = await p.request.get('/api/suggest?q=piano');
	expect(await s.json()).toEqual([]);

	await p.goto('/admin');
	await expect(p.getByRole('heading', { name: 'Pagina non trovata' })).toBeVisible();

	// Il giocatore crea una sua pagina, senza pulsante "Segreto".
	await p.goto('/wiki/new?template=none');
	await expect(p.getByRole('button', { name: /Segreto del Master/ })).toHaveCount(0);
	await expect(p.getByRole('radio', { name: /Solo Master/ })).toHaveCount(0);
	await newPage(p, 'Diario di Alice', async (pg) => {
		await pg.keyboard.type('Oggi ho incontrato Bartolo.');
	}, { visibility: 'Personale' });

	const back = await login(browser, ADMIN);
	const r2 = await back.goto('/wiki/diario-di-alice');
	expect(r2?.status()).toBe(404);
	await back.context().close();

	// Preferenze di lettura.
	await p.goto('/preferences');
	await p.getByRole('radio', { name: 'Scuro', exact: true }).check();
	await p.getByLabel('Dimensione del testo').selectOption('150');
	await p.getByLabel('Carattere').selectOption('opendyslexic');
	await p.getByRole('button', { name: 'Salva' }).first().click();
	await expect(p.getByRole('status').first()).toContainText('Preferenze salvate');
	const html = p.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await expect(html).toHaveAttribute('data-font', 'opendyslexic');
	await p.goto('/wiki/locanda-del-grifone');
	await expect(html).toHaveAttribute('style', /--font-scale:1\.5/);
	await shot(p, '06-giocatore-scuro');
	await axe(p, 'giocatore scuro');

	await p.goto('/preferences');
	await p.getByLabel('Lingua', { exact: true }).selectOption('en');
	await p.getByRole('button', { name: 'Salva' }).first().click();
	await expect(p.getByRole('heading', { level: 1, name: 'Preferences' })).toBeVisible();
	await expect(html).toHaveAttribute('lang', 'en');
	await p.context().close();
});

test('visitatori: spenti di default', async ({ browser }) => {
	const p = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await p.goto('/wiki');
	await expect(p).toHaveURL(/\/login\?next=%2Fwiki/);
	// Nessun titolo di pagina a chi non ha fatto l'accesso.
	await expect(p.getByRole('navigation', { name: TREE })).toHaveCount(0);
	expect(await p.content()).not.toContain('Bartolo Pancia');
	await axe(p, 'login');
	await shot(p, '07-login');
	await p.context().close();
});

test('temi: contrasti e accessibilità', async () => {
	for (const theme of ['Chiaro', 'Scuro']) {
		await admin.goto('/preferences');
		await admin.getByRole('radio', { name: theme, exact: true }).check();
		await admin.getByRole('button', { name: 'Salva' }).first().click();
		await expect(admin.getByRole('status').first()).toContainText('Preferenze salvate');
		for (const url of ['/', '/wiki', '/wiki/locanda-del-grifone', '/tags']) {
			await admin.goto(url);
			await axe(admin, `${theme} ${url}`);
		}
		await admin.goto('/wiki/locanda-del-grifone');
		await shot(admin, `08-tema-${theme.toLowerCase().replace(' ', '-')}`);
	}
});

test("l'albero si può nascondere", async () => {
	const save = async (choice: string) => {
		await admin.goto('/preferences');
		await admin.getByLabel('Albero delle pagine a sinistra').selectOption({ label: choice });
		await admin.getByRole('button', { name: 'Salva' }).first().click();
		await expect(admin.getByRole('status').first()).toContainText('Preferenze salvate');
	};
	await save('Nascondi');
	await admin.goto('/wiki/locanda-del-grifone');
	await expect(admin.getByRole('navigation', { name: TREE })).toHaveCount(0);
	await save('Mostra');
	await admin.goto('/wiki/locanda-del-grifone');
	await expect(admin.getByRole('navigation', { name: TREE })).toBeVisible();

	// Preferenze e Amministrazione: niente albero, anche arrivandoci dal menu.
	await admin.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link', { name: 'Preferenze', exact: true }).click();
	await expect(admin).toHaveURL(/\/preferences$/);
	await expect(admin.getByRole('navigation', { name: TREE })).toHaveCount(0);
	await expect(admin.locator('#tree-toggle')).toHaveCount(0);
	for (const url of ['/admin', '/admin/themes']) {
		await admin.goto(url);
		await expect(admin.getByRole('navigation', { name: TREE })).toHaveCount(0);
	}
	await admin.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link', { name: 'Pagine', exact: true }).click();
	await expect(admin).toHaveURL(/\/wiki$/);
	await expect(admin.getByRole('navigation', { name: TREE })).toBeVisible();
});

test('tastiera: link per saltare al contenuto', async () => {
	await admin.goto('/wiki');
	await admin.keyboard.press('Tab');
	const skip = admin.getByRole('link', { name: 'Vai al contenuto' });
	await expect(skip).toBeFocused();
	await admin.keyboard.press('Enter');
	await expect(admin.locator('#main')).toBeFocused();
});
