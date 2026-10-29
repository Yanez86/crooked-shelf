# Crooked Shelf

**Wiki self-hosted per creare, curare e registrare campagne di giochi di ruolo da tavolo** (pensata per D&D 5.5, aperta ad altri sistemi).

*A self-hosted wiki to build, maintain and chronicle tabletop RPG campaigns. Interface in Italian and English.*

## Cosa fa

- **Pagine** con editor a blocchi e Markdown, collegamenti `[[Pagina]]`, template (PNG, luoghi, fazioni, resoconti di sessione…), scheda laterale, immagini, categorie, tag e ricerca.
- **Segreti del Master**: pagine e blocchi che i giocatori non vedono e non trovano neanche cercando.
- **Ruoli**: Admin, Master, Giocatore; accesso solo su invito, visitatori spenti di default.
- **Mappe** da immagine con pin collegati a pagine e ad altre mappe, livelli, pin segreti, righello.
- **Cronologie** del mondo e della campagna con **calendari fantasy** (Harptos, inventati…); i resoconti di sessione entrano da soli.
- **Regole D&D 5.5**: `@incantesimo[Fireball]` diventa un link a D&D Beyond con l'anteprima del testo SRD 5.2.
- **Bacheche** degli appunti, personali e del gruppo.
- **Versioni** di ogni pagina, cestino.
- **Temi** (chiaro, scuro, pergamena, alto contrasto, e quelli creati da te) e **accessibilità** WCAG 2.2 AA: testo fino al 200%, caratteri per la dislessia, uso completo da tastiera.
- **Italiano e inglese**, altre lingue con un file o un plugin.
- **Plugin** di soli dati: temi, template, calendari, lingue, regole.
- **I tuoi dati restano tuoi**: backup completo, esportazione in Markdown (compatibile con Obsidian), **pacchetto mondo** `.shelf` per portare mappe e regole della casa in un'altra campagna.

## Avvio rapido

```bash
git clone https://github.com/yanez86/crooked-shelf.git
cd crooked-shelf
docker compose up -d
```

Apri http://localhost:3000: la prima volta si crea la wiki e l'account amministratore.

Senza Docker, su Raspberry Pi, su internet con HTTPS, backup e ripristino: **[docs/installazione.md](docs/installazione.md)**.

## Documentazione

- [Installazione](docs/installazione.md)
- [Guida all'uso](docs/guida.md)
- [Creare un plugin](docs/plugin.md)
- [Contribuire](CONTRIBUTING.md)
- [Progetto completo](docs/design.md)

## Licenza

Codice: [GNU AGPL-3.0](LICENSE). Puoi usarlo, modificarlo e ridistribuirlo liberamente; chi distribuisce o offre online una versione modificata deve renderne disponibile il codice.

Testi SRD 5.2: Wizards of the Coast, CC-BY-4.0; dati ricavati dal progetto 5e-database (MIT). Dettagli in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Crooked Shelf non è affiliato a Wizards of the Coast né a D&D Beyond.
