# Crooked Shelf

**Wiki self-hosted per creare, curare e registrare campagne di giochi di ruolo da tavolo** (pensata per D&D 5.5, aperta ad altri sistemi).

*A self-hosted wiki to build, maintain and chronicle tabletop RPG campaigns. Interface in Italian and English.*

## Cosa fa

- **Pagine** con editor a blocchi e Markdown, collegamenti `[[Pagina]]`, copertina e icona come in Notion, immagini, categorie, tag e ricerca. Ogni pagina è bianca o la fotocopia di un **template**.
- **Tipi di pagina**: pagina, template (la struttura base da fotocopiare, decisa da te), mappa, cronologia, bacheca.
- **Barra a sinistra** con tutta la wiki: nuova pagina e albero come in Esplora risorse, con le categorie come cartelle da aprire e chiudere (e da creare direttamente lì) e le pagine di ogni tipo dentro.
- **Colonna a lato** delle pagine, solo se serve: in modifica la aggiungi col «+» e ci metti riquadri di testo o immagini.
- **Galleria** con tutte le immagini della campagna (pagine, testo, mappe) e visore a schermo intero.
- **Segreti del Master**: pagine e blocchi che i giocatori non vedono e non trovano neanche cercando.
- **Ruoli**: Admin, Master, Giocatore; accesso solo su invito, visitatori spenti di default.
- **Mappe**: pagine con un'immagine, pin collegati a pagine e ad altre mappe, livelli, pin segreti, righello.
- **Cronologie**: pagine del mondo o della campagna, quante ne vuoi, con **calendari fantasy** (Harptos, inventati…); i resoconti di sessione entrano da soli.
- **Regole D&D 5.5**: `@incantesimo[Fireball]` mostra l'anteprima del testo SRD 5.2; con il plugin D&D Beyond diventa anche un link al sito.
- **Bacheche** degli appunti: pagine con schede in colonne, personali o del gruppo.
- **Versioni** di ogni pagina, cestino.
- **Temi** (chiaro, scuro e quelli creati da te) e **accessibilità** WCAG 2.2 AA: testo fino al 200%, caratteri per la dislessia, uso completo da tastiera.
- **Italiano e inglese**, altre lingue con un file o un plugin.
- **Plugin** di soli dati: temi, template, calendari, lingue, regole, link a siti esterni.
- **Più campagne nella stessa installazione**, ognuna con il suo Master, i suoi giocatori e una wiki tutta sua.
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
