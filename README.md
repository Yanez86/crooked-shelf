# Crooked Shelf

Wiki self-hosted per creare, curare e registrare campagne di giochi di ruolo da tavolo (D&D 5.5 e altri sistemi).

*Self-hosted wiki to build, maintain and chronicle tabletop RPG campaigns (D&D 5.5 and other systems).*

Progetto completo: [docs/design.md](docs/design.md).

## Stato

**Fase 1 completata**:
- accesso con ruoli (Admin, Master, Giocatore), inviti con link, visitatori spenti di default
- pagine con editor a blocchi e Markdown, collegamenti `[[Pagina]]` con suggerimenti, pagine che collegano qui
- blocchi segreti del Master, visibilità per pagina (pubblica, giocatori, solo Master, personale)
- categorie annidate e tag colorati, ricerca nel testo
- italiano e inglese, quattro temi (chiaro, scuro, pergamena, alto contrasto)
- preferenze di lettura: dimensione del testo, font ad alta leggibilità o per la dislessia, spaziatura, riduci movimento

**Fase 2 completata**:
- template preinstallati (PNG, personaggio giocante, luogo, fazione, oggetto, divinità, mostro, resoconto di sessione, regola della casa) e template creati dal Master
- scheda laterale con campi (anche con `[[collegamenti]]`), immagini nelle pagine con descrizione per chi non vede
- mappe da immagine con pin collegati a pagine e ad altre mappe, livelli, pin segreti, righello delle distanze, elenco accessibile dei pin
- cronologia del mondo e della campagna, calendari personalizzati (gregoriano, Harptos, semplice o inventato), resoconti di sessione che entrano da soli nella cronologia

Prossime fasi: bacheca, regole (D&D Beyond + SRD 5.2), editor dei temi, cronologia delle modifiche, plugin, Docker.

## Avvio

Serve Node.js 22.17 o più recente.

```bash
npm install
npm run build
npm start
```

Apri `http://localhost:3000`: la prima volta si crea la wiki e l'account amministratore.

| Variabile | Significato | Predefinito |
|---|---|---|
| `PORT` | porta | `3000` |
| `CS_DATA_DIR` | cartella dei dati (database e immagini caricate) | `./data` |
| `CS_ORIGIN` | indirizzo pubblico, es. `https://wiki.esempio.it` | — |
| `CS_TRUST_PROXY` | `1` dietro un proxy (Caddy, nginx) che invia `X-Forwarded-*` | — |

**Backup**: copia la cartella `data` (a server fermo).

## Sviluppo

```bash
npm run dev         # server di sviluppo
npm run check       # controllo dei tipi
npm run test:unit   # test delle regole (permessi, contenuti, temi, traduzioni)
npm run test:e2e    # test nel browser con Playwright e controlli di accessibilità axe
```

Le traduzioni sono in `src/lib/i18n/locales/`: una lingua nuova è un file JSON nuovo.

## Licenza

[GNU AGPL-3.0](LICENSE). Testi SRD 5.2 (quando arriveranno): CC-BY-4.0, Wizards of the Coast. Progetto non affiliato a Wizards of the Coast né a D&D Beyond.
