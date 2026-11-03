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
	await expect(content.getByRole('link', { name: /^Fireball/ })).toHaveAttribute('href', '/rules/spell/fireball');
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

test('anteprima della regola dentro la pagina aperta dalla mappa', async () => {
	await admin.goto('/maps/costa-della-spada');
	await admin.getByRole('button', { name: 'Waterdeep', exact: true }).click();
	const pinPage = admin.getByRole('dialog', { name: 'Locanda del Grifone' });
	const info = pinPage.getByRole('button', { name: 'Anteprima: Fireball' });
	await info.click();
	const rule = pinPage.getByRole('dialog', { name: 'Fireball' });
	await expect(rule).toContainText('8d6');
	await expect(rule.getByRole('heading', { name: 'Fireball' })).toBeFocused();
	await axe(admin, 'anteprima regola sopra la mappa');
	// Il primo Esc chiude l'anteprima, il secondo la pagina.
	await admin.keyboard.press('Escape');
	await expect(rule).toBeHidden();
	await expect(pinPage).toBeVisible();
	await expect(info).toBeFocused();
	await admin.keyboard.press('Escape');
	await expect(pinPage).toBeHidden();
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

	const row = admin.locator('main li', { hasText: 'Pagina da cestinare' });
	await expect(row).toContainText(/creata da .+ il .+, ultima modifica /);
	await axe(admin, 'cestino');
	await admin.getByRole('button', { name: /^Recupera ?: Pagina da cestinare$/ }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Pagina da cestinare' })).toBeVisible();
	await admin.goto('/search?q=sparirà');
	await expect(admin.locator('main').getByRole('link', { name: 'Pagina da cestinare' })).toBeVisible();

	await admin.goto('/wiki/pagina-da-cestinare/edit');
	await admin.getByRole('checkbox', { name: /Sì, voglio eliminare/ }).check();
	await admin.getByRole('button', { name: 'Elimina la pagina' }).click();
	await admin.goto('/trash');
	await admin.getByRole('checkbox', { name: /Sono sicuro/ }).check();
	await admin.getByRole('button', { name: /^Elimina per sempre ?: Pagina da cestinare$/ }).click();
	await expect(admin.getByRole('status').first()).toContainText('eliminata per sempre');
	await expect(admin.locator('main')).toContainText('Il cestino è vuoto');
});

test('bacheche: sono pagine', async ({ browser }) => {
	// Nuova pagina → Nuova bacheca, con le colonne di base.
	await admin.goto('/wiki/new');
	await admin.locator('main').getByRole('link', { name: /^Nuova bacheca/ }).click();
	await expect(admin.getByLabel('Colonne', { exact: true })).toHaveValue('Indizi\nDomande\nRisolto');
	await axe(admin, 'nuova bacheca');
	await admin.getByLabel('Titolo', { exact: true }).fill('Missioni del gruppo');
	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Missioni del gruppo' })).toBeVisible();
	// Sta nell'albero a sinistra come le altre pagine.
	await expect(admin.locator('#explorer').getByRole('link', { name: 'Missioni del gruppo, Bacheca' })).toBeVisible();

	const col = (name: string) => admin.getByRole('listitem').filter({ has: admin.getByRole('heading', { level: 2, name: new RegExp(`^${name}`) }) });
	await col('Indizi').locator('summary', { hasText: 'Aggiungi scheda' }).click();
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

	await col('Domande').locator('summary', { hasText: 'Aggiungi scheda' }).click();
	await col('Domande').getByLabel('Titolo').fill('Dove dorme il drago?');
	await col('Domande').getByRole('button', { name: 'Aggiungi scheda' }).click();
	await expect(col('Domande').getByRole('article')).toHaveCount(2);

	// Trascinamento.
	// Scheda e colonna insieme sullo schermo: a metà trascinamento la pagina non scorre.
	await admin.setViewportSize({ width: 1280, height: 1200 });
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
	await admin.goto('/wiki/new?kind=board');
	await admin.getByLabel('Titolo', { exact: true }).fill('Idee segrete');
	await admin.getByRole('button', { name: 'Opzioni pagina' }).click();
	await admin.getByRole('radio', { name: 'Personale' }).check();
	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Idee segrete' })).toBeVisible();
	const personalUrl = admin.url();

	const p = await login(browser, PLAYER);
	await p.goto('/');
	await expect(p.locator('#explorer')).toContainText('Missioni del gruppo');
	await expect(p.locator('#explorer')).not.toContainText('Idee segrete');
	expect((await p.goto(personalUrl))?.status()).toBe(404);
	await p.goto(boardUrl);
	await expect(p.getByRole('article', { name: 'Chi è il cuoco?' })).toBeVisible();
	// Le schede le usa, le colonne no (la pagina non è sua).
	await expect(p.getByLabel('Nuova colonna')).toHaveCount(0);
	await p.context().close();
});

test('schede giocatore: la cartella PG, chi è al tavolo, le pagine dentro la scheda', async ({ browser }) => {
	// Alice è entrata con l'invito: ha la sua scheda nella cartella PG, e la home dice chi è al tavolo.
	await admin.goto('/');
	const table = admin.getByRole('region', { name: 'Al tavolo' });
	await expect(table).toContainText('Davide');
	await expect(table).toContainText('Master');
	await expect(table.getByRole('link', { name: /^Alice/ })).toHaveAttribute('href', '/wiki/alice');
	await axe(admin, 'home: al tavolo');
	await shot(admin, '23b-al-tavolo');

	// Nell'albero: la cartella PG e la scheda non vanno nel cestino.
	const tree = admin.locator('#explorer');
	await expect(tree.locator('summary', { hasText: 'PG' })).toBeVisible();
	await expect(tree.getByRole('button', { name: 'Sposta nel cestino: PG' })).toHaveCount(0);
	await expect(tree.getByRole('button', { name: 'Sposta nel cestino: Alice' })).toHaveCount(0);

	// Il Master la modifica, ma senza segreti, senza cambiarle cartella, e solo tra Pubblica e Giocatori.
	await admin.goto('/wiki/alice');
	await expect(admin.locator('.meta')).toContainText('Scheda di Alice');
	await expect(admin.getByText('Questa è la scheda di Alice')).toBeVisible();
	await expect(admin.locator('.content')).toContainText('Il personaggio');
	await admin.goto('/wiki/alice/edit');
	await expect(admin.getByRole('button', { name: /Segreto del Master/ })).toHaveCount(0);
	await expect(admin.getByLabel('Categoria')).toHaveCount(0);
	await admin.getByRole('button', { name: 'Opzioni pagina' }).click();
	await expect(admin.getByRole('radio', { name: 'Giocatori' })).toBeChecked();
	await expect(admin.getByRole('radio', { name: 'Pubblica' })).toBeVisible();
	await expect(admin.getByRole('radio', { name: /Solo Master/ })).toHaveCount(0);
	await expect(admin.getByRole('radio', { name: 'Personale' })).toHaveCount(0);
	await expect(admin.getByLabel('È un template')).toHaveCount(0);
	await expect(admin.getByLabel('Pagina home')).toHaveCount(0);
	await expect(admin.getByRole('heading', { name: 'Eliminare la pagina' })).toHaveCount(0);

	// Nella pagina Campagna: il template delle schede nuove, e la scheda di ogni giocatore.
	await admin.goto('/campaign?tab=players');
	await expect(admin.getByLabel('Template delle schede nuove')).toHaveValue('scheda-giocatore');
	await expect(admin.locator('main').getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/wiki/alice');
	await admin.getByLabel('Template delle schede nuove').selectOption('');
	await admin.locator('form[action="?/sheetTemplate&tab=players"]').getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('status').filter({ hasText: 'Template delle schede salvato' })).toBeVisible();
	await expect(admin.getByLabel('Template delle schede nuove')).toHaveValue('');
	await axe(admin, 'campagna: schede giocatore');
	await admin.getByLabel('Template delle schede nuove').selectOption('scheda-giocatore');
	await admin.locator('form[action="?/sheetTemplate&tab=players"]').getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByLabel('Template delle schede nuove')).toHaveValue('scheda-giocatore');

	// Alice dà alla sua scheda il nome del personaggio.
	const p = await login(browser, PLAYER);
	await p.goto('/');
	await p.getByRole('region', { name: 'Al tavolo' }).getByRole('link', { name: /^Alice/ }).click();
	await expect(p.getByRole('heading', { level: 1, name: 'Alice' })).toBeVisible();
	await expect(p.getByText('Questa è la tua scheda')).toBeVisible();
	await axe(p, 'scheda giocatore');
	await p.goto('/wiki/alice/edit');
	await p.getByLabel('Titolo', { exact: true }).fill('Thalia');
	await p.locator('.editor-content p').first().click();
	await p.keyboard.type('Ranger elfa dei boschi.');
	await p.getByRole('button', { name: 'Salva' }).click();
	await expect(p.getByRole('heading', { level: 1, name: 'Thalia' })).toBeVisible();
	await expect(p.locator('.content')).toContainText('Ranger elfa dei boschi.');
	await p.goto('/');
	await expect(p.getByRole('region', { name: 'Al tavolo' }).getByRole('link', { name: /^Alice/ })).toContainText('Thalia');

	// Una pagina dentro la scheda: parte Personale, e il Master non la vede.
	await p.goto('/wiki/alice');
	await p.getByRole('link', { name: 'Nuova pagina qui dentro' }).click();
	await p.locator('main').getByRole('link', { name: /^Pagina bianca/ }).click();
	await expect(p.getByText('Dentro: Thalia')).toBeVisible();
	await p.getByLabel('Titolo', { exact: true }).fill('Segreti di Thalia');
	await p.locator('.editor-content').click();
	await p.keyboard.type('Mio fratello è nella gilda dei ladri.');
	await p.getByRole('button', { name: 'Opzioni pagina' }).click();
	await expect(p.getByRole('radio', { name: 'Personale' })).toBeChecked();
	await p.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(p.getByRole('heading', { level: 1, name: 'Segreti di Thalia' })).toBeVisible();
	await expect(p.getByRole('navigation', { name: 'Percorso della pagina' }).getByRole('link', { name: 'Thalia', exact: true })).toHaveAttribute('href', '/wiki/alice');
	// La scheda non va nel cestino; la pagina dentro sì.
	await expect(p.locator('#explorer').getByRole('button', { name: 'Sposta nel cestino: Thalia' })).toHaveCount(0);
	await expect(p.locator('#explorer').getByRole('button', { name: 'Sposta nel cestino: Segreti di Thalia' })).toHaveCount(1);
	await p.context().close();
	expect((await admin.goto('/wiki/segreti-di-thalia'))?.status()).toBe(404);
});

test('appuntamenti: il Master fissa i giovedì, i giocatori rispondono, sotto il minimo si salta', async ({ browser }) => {
	// Nella pagina Campagna: il link per il remoto e la regola del minimo.
	await admin.goto('/campaign?tab=schedule');
	const rules = admin.locator('form[action="?/schedule&tab=schedule"]');
	await rules.getByLabel('Link per il remoto (Discord o altro)').fill('javascript:alert(1)');
	await rules.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('alert')).toContainText('indirizzo web');
	await rules.getByLabel('Link per il remoto (Discord o altro)').fill('https://discord.gg/grifone');
	await rules.getByLabel('Giocatori minimi').fill('1');
	await rules.getByRole('button', { name: 'Salva' }).click();
	await expect(rules.getByRole('status')).toContainText('Modifiche salvate');

	// Ogni giovedì di gennaio 2030, in presenza o da remoto.
	await admin.locator('#explorer').getByRole('link', { name: 'Appuntamenti' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Appuntamenti' })).toBeVisible();
	await admin.getByRole('link', { name: 'Nuovo appuntamento' }).click();
	await admin.getByLabel('Titolo', { exact: true }).fill('Serata al Grifone');
	await admin.getByLabel('Data', { exact: true }).fill('2030-01-03');
	await admin.getByLabel('Inizio', { exact: true }).fill('20:00');
	await admin.getByLabel('Fine', { exact: true }).fill('00:00');
	await admin.getByLabel('Si ripete').selectOption({ label: 'Ogni settimana' });
	await admin.getByLabel('Dove', { exact: true }).fill('Locanda del Grifone');
	await admin.getByLabel('Da remoto', { exact: true }).check();
	await axe(admin, 'nuovo appuntamento');
	await admin.getByRole('button', { name: "Crea l'appuntamento" }).click();
	await admin.waitForURL('**/schedule?m=2030-01');
	const dates = admin.locator('article.occurrence');
	await expect(dates).toHaveCount(5);
	await expect(admin.getByRole('table', { name: 'gennaio 2030' }).getByRole('link', { name: /20:00 Serata al Grifone/ })).toHaveCount(5);
	await expect(dates.first()).toContainText('In forse');
	await expect(dates.first().getByRole('link', { name: 'https://discord.gg/grifone' })).toBeVisible();
	await axe(admin, 'appuntamenti');
	await shot(admin, '23c-appuntamenti');

	// Alice viene da remoto il 10: con lei si arriva al minimo.
	const p = await login(browser, PLAYER);
	await p.goto('/schedule?m=2030-01');
	const tenth = p.locator('article.occurrence').filter({ has: p.locator('time[datetime="2030-01-10T20:00"]') });
	await expect(tenth.getByRole('button', { name: 'Ci sono, in presenza' })).toBeVisible();
	await tenth.getByRole('button', { name: 'Ci sono, da remoto' }).click();
	await expect(tenth.getByRole('button', { name: 'Ci sono, da remoto' })).toHaveAttribute('aria-pressed', 'true');
	await expect(tenth).toContainText('Confermata');
	await expect(tenth).toContainText(/Vengono da remoto\s*Alice/);
	await axe(p, 'appuntamenti: giocatore');
	// Nel calendario la sua figura (col bordo del remoto) accanto a quella del Master; cliccando, il popup con le specifiche.
	const cell = p.getByRole('table', { name: 'gennaio 2030' }).getByRole('link', { name: /20:00 Serata al Grifone/ }).nth(1);
	await expect(cell.locator('.face.remote')).toHaveAttribute('title', 'Alice: Ci sono, da remoto');
	await expect(cell.locator('.face.master')).toHaveAttribute('title', /: Master$/);
	await cell.click();
	const dlg = p.getByRole('dialog', { name: 'Serata al Grifone' });
	await expect(dlg).toContainText(/Vengono da remoto\s*Alice/);
	await expect(dlg.getByRole('button', { name: 'Ci sono, da remoto' })).toHaveAttribute('aria-pressed', 'true');
	await axe(p, 'appuntamenti: popup');
	await shot(p, '23c-appuntamenti-popup');
	await dlg.getByRole('button', { name: 'Ci sono, in presenza' }).click();
	await expect(dlg.getByRole('button', { name: 'Ci sono, in presenza' })).toHaveAttribute('aria-pressed', 'true');
	await expect(cell.locator('.face.in_person')).toHaveCount(1);
	await dlg.getByRole('button', { name: 'Chiudi' }).click();
	await expect(dlg).toBeHidden();
	await shot(p, '23c-appuntamenti-risposte');
	// Il giocatore non scrive appuntamenti.
	await expect(p.getByRole('link', { name: 'Nuovo appuntamento' })).toHaveCount(0);
	expect((await p.goto('/schedule/new'))?.status()).toBe(404);
	await p.context().close();

	// Il Master annulla il 17 e vede la risposta di Alice, cambiata nel popup.
	await admin.reload();
	await expect(dates.nth(1)).toContainText(/Vengono in presenza\s*Alice/);
	await dates.nth(2).getByRole('button', { name: /^Annulla questa data/ }).click();
	await expect(dates).toHaveCount(4);
	await expect(admin.locator('time[datetime="2030-01-17T20:00"]')).toHaveCount(0);

	// Senza regola, niente stato.
	await admin.goto('/campaign?tab=schedule');
	await rules.getByLabel('Giocatori minimi').fill('0');
	await rules.getByRole('button', { name: 'Salva' }).click();
	await expect(rules.getByRole('status')).toContainText('Modifiche salvate');
	await admin.goto('/schedule?m=2030-01');
	await expect(dates.first()).not.toContainText('In forse');

	// In home, sotto il tavolo: la prossima sessione, a cui Alice non ha ancora risposto.
	const d = new Date(Date.now() + 86_400_000);
	const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	await admin.goto('/schedule/new');
	await admin.getByLabel('Titolo', { exact: true }).fill('Il porto');
	await admin.getByLabel('Data', { exact: true }).fill(tomorrow);
	await admin.getByRole('button', { name: "Crea l'appuntamento" }).click();
	await admin.waitForURL(`**/schedule?m=${tomorrow.slice(0, 7)}`);
	const a = await login(browser, PLAYER);
	await a.goto('/');
	const next = a.getByRole('region', { name: 'Prossima sessione' });
	await expect(next.getByRole('link', { name: /Il porto/ })).toContainText('Non hai ancora risposto');
	await next.getByRole('link', { name: /Il porto/ }).click();
	await a.waitForURL(`**/schedule?m=${tomorrow.slice(0, 7)}#o-*`);
	await a.context().close();
});

test('Stars & Wishes: chi c\'era risponde entrando nella campagna, una volta sola; il Master legge', async ({ browser }) => {
	// Una sessione ieri, già finita, e Alice c'era. La prossima è a gennaio 2030 (il test prima).
	const d = new Date(Date.now() - 86_400_000);
	const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	const month = `/schedule?m=${yesterday.slice(0, 7)}`;
	await admin.goto('/schedule/new');
	await admin.getByLabel('Titolo', { exact: true }).fill('La cripta');
	await admin.getByLabel('Data', { exact: true }).fill(yesterday);
	await admin.getByLabel('Inizio', { exact: true }).fill('18:00');
	await admin.getByLabel('Fine', { exact: true }).fill('20:00');
	await admin.getByRole('button', { name: "Crea l'appuntamento" }).click();
	await admin.waitForURL(`**${month}`);
	let p = await login(browser, PLAYER);
	await p.goto(month);
	const crypt = (pg: Page) => pg.locator('article.occurrence').filter({ has: pg.locator(`time[datetime="${yesterday}T18:00"]`) });
	await crypt(p).getByRole('button', { name: 'Ci sono, in presenza' }).click();
	await expect(crypt(p).getByRole('button', { name: 'Ci sono, in presenza' })).toHaveAttribute('aria-pressed', 'true');
	await p.context().close();

	// Spento finché il Master non lo accende.
	await admin.goto('/campaign?tab=schedule');
	const rules = admin.locator('form[action^="?/schedule"]');
	await rules.getByLabel(/^Stars & Wishes/).check();
	await rules.getByRole('button', { name: 'Salva' }).click();
	await expect(rules.getByRole('status')).toContainText('Modifiche salvate');

	// Entrando nella campagna, il popup. «Più tardi» lo rimanda al prossimo ingresso, non alla pagina dopo.
	p = await login(browser, PLAYER);
	let sw = p.getByRole('dialog', { name: 'Stars & Wishes' });
	await expect(sw).toBeVisible();
	await expect(sw).toContainText('«La cripta»');
	await expect(sw.getByLabel('Che cosa ti è piaciuto di questa sessione?')).toBeFocused();
	await axe(p, 'star & wishes');
	await shot(p, '23d-star-wishes');
	await sw.getByRole('button', { name: 'Più tardi' }).click();
	await expect(sw).toBeHidden();
	await p.reload();
	await expect(sw).toHaveCount(0);
	await p.context().close();

	// Si rientra e si risponde: almeno una delle due, e poi non si cambia più.
	p = await login(browser, PLAYER);
	sw = p.getByRole('dialog', { name: 'Stars & Wishes' });
	await sw.getByRole('button', { name: 'Invia' }).click();
	await expect(sw.getByRole('alert')).toContainText('almeno una');
	await sw.getByLabel('Che cosa ti è piaciuto di questa sessione?').fill('Il drago nella cripta');
	await sw.getByLabel('Che cosa ti piacerebbe esplorare nella prossima sessione?').fill('La torre del mago');
	await sw.getByRole('button', { name: 'Invia' }).click();
	await expect(sw.getByRole('status')).toContainText('Grazie');
	await expect(sw.getByRole('button', { name: 'Chiudi' }).first()).toBeFocused();
	await sw.getByRole('button', { name: 'Chiudi' }).first().click();
	await expect(sw).toBeHidden();
	await p.context().close();
	p = await login(browser, PLAYER);
	await expect(p.getByRole('dialog', { name: 'Stars & Wishes' })).toHaveCount(0);
	const res = await p.request.post('/schedule?/starWish', { form: { star: 'Cambio idea' }, headers: { origin: new URL(p.url()).origin } });
	expect(res.status()).toBe(400);
	// Le risposte sono del Master.
	await p.goto(month);
	await expect(crypt(p)).not.toContainText('Il drago nella cripta');
	await p.context().close();

	await admin.goto(month);
	await expect(crypt(admin).getByRole('heading', { name: 'Stars & Wishes' })).toBeVisible();
	await expect(crypt(admin)).toContainText(/Alice\s*Gli è piaciuto\s*Il drago nella cripta\s*Vorrebbe esplorare\s*La torre del mago/);
	await axe(admin, 'star & wishes: il Master');

	// Spento: le risposte spariscono dalla vista, ma restano salvate.
	await admin.goto('/campaign?tab=schedule');
	await rules.getByLabel(/^Stars & Wishes/).uncheck();
	await rules.getByRole('button', { name: 'Salva' }).click();
	await expect(rules.getByRole('status')).toContainText('Modifiche salvate');
	await admin.goto(month);
	await expect(crypt(admin)).not.toContainText('Il drago nella cripta');
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

	// Lo sfondo: si carica, sta dietro la pagina e si toglie, e allora il file sparisce.
	await admin.goto('/admin/themes/custom-1');
	await admin.getByLabel("Carica un'immagine").setInputFiles('tests/fixtures/city.png');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('status').first()).toContainText('Modifiche salvate');
	const bg = await admin.getByRole('img', { name: 'Sfondo attuale' }).getAttribute('src');
	await admin.goto('/wiki/locanda-del-grifone');
	expect(await admin.locator('.backdrop').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(bg!);
	await axe(admin, 'tema con sfondo');
	await admin.goto('/admin/themes/custom-1');
	await admin.getByLabel('Togli lo sfondo').check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('img', { name: 'Sfondo attuale' })).toHaveCount(0);
	expect((await admin.request.get(bg!)).status()).toBe(404);

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
