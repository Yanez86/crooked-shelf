# Contribuire a Crooked Shelf

Grazie! Ogni aiuto è benvenuto: codice, traduzioni, temi, plugin, segnalazioni.

## Preparare l'ambiente

Serve Node.js 22.17 o più recente.

```bash
npm ci
npm run dev        # wiki su http://localhost:5173
```

## Prima di proporre una modifica

```bash
npm run check      # controllo dei tipi
npm run test:unit  # regole: permessi, contenuti, calendari, temi, traduzioni, plugin, pacchetti
npm run test:e2e   # browser (Playwright) con controlli di accessibilità (axe)
```

I test nel browser partono da una wiki vuota e sono una storia unica in ordine (`tests/e2e/1-…`, `2-…`, …). Gli screenshot finiscono in `test-results/screens/`.

Per provarli sull'immagine Docker: `docker run -d -p 4300:3000 crooked-shelf` e poi `E2E_BASE_URL=http://localhost:4300 npm run test:e2e`.

## Come è fatto

| Cartella | Contenuto |
|---|---|
| `src/routes/` | le pagine (SvelteKit) |
| `src/lib/server/` | database (SQLite + Drizzle), permessi, pagine, mappe, cronologie, plugin, backup, pacchetti |
| `src/lib/content/` | formato delle pagine: HTML, Markdown, testo per la ricerca |
| `src/lib/editor/` | editor a blocchi (TipTap) |
| `src/lib/i18n/locales/` | traduzioni |
| `src/lib/themes.ts` | temi e controllo dei contrasti |
| `src/lib/server/rules/` | testi SRD 5.2 (generati con `tools/import-srd.mjs`) |
| `plugins/` | plugin inclusi (esempi) |
| `docs/` | progetto, installazione, guida, plugin |

Regole importanti:

- **Sicurezza**: i permessi si controllano sempre sul server (`src/lib/access.ts`, `visibility.ts`). Il testo segreto non deve mai arrivare al browser di chi non è Master: né nella pagina, né nella ricerca, nei suggerimenti, nelle versioni o nelle esportazioni.
- **Accessibilità** (WCAG 2.2 AA): tutto usabile da tastiera, etichette su ogni campo, niente informazioni affidate solo al colore, pulsanti di almeno 24×24 px. I test con axe devono passare.
- **Database**: per cambiarlo aggiungi una migrazione in fondo a `src/lib/server/db/migrations.ts`; non modificare quelle già pubblicate.
- **Testi**: ogni testo dell'interfaccia passa dalle traduzioni (`t('chiave')`), con la stessa chiave in `it.json` e `en.json` (un test lo controlla).

## Versioni

Versionamento semantico (MAGGIORE.MINORE.CORRETTIVA). Per una nuova versione:

1. aggiungi in cima a `CHANGELOG.md` la sezione `## X.Y.Z — AAAA-MM-GG` con le voci (`### Aggiunte`, `### Modifiche`, `### Correzioni`); è anche la pagina `/changelog`;
2. `npm version X.Y.Z` aggiorna `package.json` e crea il commit e il tag `vX.Y.Z` (un test controlla che le due versioni coincidano).

## Traduzioni

Copia `src/lib/i18n/locales/en.json` in un nuovo file (es. `es.json`), cambia `_meta.name` e traduci. Le chiavi mancanti ricadono sull'inglese. In alternativa si può distribuire come plugin (vedi `docs/plugin.md`).

## Licenza

Contribuendo accetti che il tuo lavoro sia distribuito con la licenza del progetto, [GNU AGPL-3.0](LICENSE).
