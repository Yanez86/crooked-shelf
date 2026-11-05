# Crooked Shelf

**English** · [Italiano](#italiano)

A self-hosted wiki for tabletop RPG campaigns. Built for D&D 5.5, usable with any system. Version 0.20.5.

## How it works

You install it once on a computer (PC, Raspberry Pi or VPS) and everyone uses it from the browser, phone included.

- **Roles**: the Admin runs the site, the Master runs a campaign, Players write and read. Access by invitation only.
- **Campaigns**: one installation, many campaigns. Each one has its own Master, players and pages.
- **Pages**: block editor with Markdown, `[[Page]]` links, cover, icon, tags and search. Start blank or from a **template**.
- **Master's secrets**: the Master hides single blocks with the eye icon. Players never receive them, not even in search, versions or exports, and can still edit the page.
- **Page types**: page, template, map (pins and layers), timeline (fantasy calendars), board (cards in columns).
- **Player sheets**: every player gets a page in the PCs folder when they join.
- **Sessions**: a calendar of game dates. Players answer in person, remote or absent; below a minimum the session is cancelled. After each session, optional Stars & Wishes feedback. An option the Master turns on per campaign.
- **Rules**: `@spell[Fireball]` shows the SRD 5.2 text; the D&D Beyond plugin links to the site.
- **Resources and gallery**: images, audio and files of the campaign in one place.
- **History**: every save is a version; deleted pages go to the trash.
- **Accessibility**: WCAG 2.2 AA, keyboard only, text up to 200%, dyslexia fonts, light, dark and custom themes.
- **Languages**: Italian and English; more via a file or a plugin.
- **Plugins**: data only (themes, templates, calendars, languages, rules, links), never code.
- **Claude**: the Master can connect Claude to a campaign to search, read and, if allowed, write pages.
- **Your data**: full backup, also automatic every day into a folder such as OneDrive or Google Drive, optionally encrypted with a password; Markdown export (Obsidian-ready), `.shelf` world pack to move a world to another campaign.

## Quick start

```bash
git clone https://github.com/yanez86/crooked-shelf.git
cd crooked-shelf
docker compose up -d
```

Open http://localhost:3000. On first run you create the wiki and the admin account with the setup code printed in `docker compose logs`.

Without Docker, on a Raspberry Pi or online with HTTPS: see [docs/installazione.md](docs/installazione.md).

## Documentation (Italian)

- [Installation](docs/installazione.md)
- [User guide](docs/guida.md)
- [Plugins](docs/plugin.md)
- [Claude](docs/claude.md)
- [Contributing](CONTRIBUTING.md)
- [Design document](docs/design.md)
- [Changelog](CHANGELOG.md)

## License

Code: [GNU AGPL-3.0](LICENSE). Whoever distributes or hosts a modified version must publish its source.

SRD 5.2 texts: Wizards of the Coast, CC-BY-4.0; data from the 5e-database project (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Crooked Shelf is not affiliated with Wizards of the Coast or D&D Beyond.

---

## Italiano

[English](#crooked-shelf) · **Italiano**

Una wiki self-hosted per campagne di giochi di ruolo da tavolo. Pensata per D&D 5.5, usabile con ogni sistema. Versione 0.20.5.

## Come funziona

La installi una volta su un computer (PC, Raspberry Pi o VPS) e tutti la usano dal browser, anche dal telefono.

- **Ruoli**: l'Admin gestisce il sito, il Master una campagna, i Giocatori leggono e scrivono. Si entra solo su invito.
- **Campagne**: una installazione, più campagne. Ognuna ha il suo Master, i suoi giocatori e le sue pagine.
- **Pagine**: editor a blocchi con Markdown, collegamenti `[[Pagina]]`, copertina, icona, tag e ricerca. Si parte da una pagina bianca o da un **template**.
- **Segreti del Master**: il Master oscura un singolo blocco con l'occhio. Ai giocatori non arriva mai, neanche nella ricerca, nelle versioni o nelle esportazioni, e possono comunque modificare la pagina.
- **Tipi di pagina**: pagina, template, mappa (pin e livelli), cronologia (calendari fantasy), bacheca (schede in colonne).
- **Schede giocatore**: ogni giocatore ha una pagina nella cartella PG, creata quando entra.
- **Appuntamenti**: il calendario delle sessioni. I giocatori rispondono in presenza, da remoto o assenti; sotto il minimo la sessione salta. Dopo ogni sessione, Stars & Wishes facoltativo. È un'opzione che il Master accende per ogni campagna.
- **Regole**: `@incantesimo[Fireball]` mostra il testo SRD 5.2; il plugin D&D Beyond porta al sito.
- **Risorse e galleria**: immagini, audio e file della campagna in un posto solo.
- **Storia**: ogni salvataggio è una versione; le pagine eliminate vanno nel cestino.
- **Accessibilità**: WCAG 2.2 AA, tutto da tastiera, testo fino al 200%, caratteri per la dislessia, temi chiaro, scuro e personalizzati.
- **Lingue**: italiano e inglese; altre con un file o un plugin.
- **Plugin**: solo dati (temi, template, calendari, lingue, regole, link), mai codice.
- **Claude**: il Master può collegare Claude a una campagna per cercare, leggere e, se lo permette, scrivere pagine.
- **I tuoi dati**: backup completo, anche automatico ogni giorno in una cartella come quella di OneDrive o Google Drive, se vuoi cifrato con una password; esportazione in Markdown (compatibile con Obsidian), pacchetto mondo `.shelf` per portare un mondo in un'altra campagna.

## Avvio rapido

```bash
git clone https://github.com/yanez86/crooked-shelf.git
cd crooked-shelf
docker compose up -d
```

Apri http://localhost:3000. La prima volta crei la wiki e l'account amministratore col codice di configurazione scritto in `docker compose logs`.

Senza Docker, su Raspberry Pi o su internet con HTTPS: vedi [docs/installazione.md](docs/installazione.md).

## Documentazione

- [Installazione](docs/installazione.md)
- [Guida all'uso](docs/guida.md)
- [Creare un plugin](docs/plugin.md)
- [Claude](docs/claude.md)
- [Contribuire](CONTRIBUTING.md)
- [Documento di progetto](docs/design.md)
- [Novità](CHANGELOG.md)

## Licenza

Codice: [GNU AGPL-3.0](LICENSE). Chi distribuisce o offre online una versione modificata deve pubblicarne il codice.

Testi SRD 5.2: Wizards of the Coast, CC-BY-4.0; dati dal progetto 5e-database (MIT). Dettagli in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Crooked Shelf non è affiliato a Wizards of the Coast né a D&D Beyond.
