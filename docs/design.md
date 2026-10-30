# Crooked Shelf — Documento di progetto

Wiki self-hosted per creare, curare e registrare campagne di giochi di ruolo da tavolo (pensata per D&D 5.5, aperta ad altri sistemi).

> Stato: **approvato**. Tutte e quattro le fasi completate (versione 0.9.0, da provare).

## 1. Obiettivi

- Una wiki per **un gruppo di gioco** per installazione: mondo, personaggi, luoghi, sessioni.
- Facile da ospitare in casa (Docker, Raspberry Pi, VPS) e da trasferire.
- Scrittura comoda a blocchi con Markdown e collegamenti tra pagine.
- Accessibile (WCAG 2.2 AA), in italiano e inglese, estendibile con plugin.
- Software libero con licenza **AGPL-3.0**.

## 2. Tecnologie

| Parte | Scelta | Perché |
|---|---|---|
| Linguaggio | TypeScript | Un solo linguaggio per server e interfaccia |
| Applicazione | SvelteKit (Node.js) | Leggero, veloce anche su telefono, server e interfaccia nello stesso progetto |
| Database | SQLite (predefinito), PostgreSQL (opzionale) | SQLite = un file solo, backup copiandolo |
| Accesso ai dati | Drizzle ORM | Supporta sia SQLite sia PostgreSQL |
| Editor | TipTap (ProseMirror) | Blocchi, scorciatoie Markdown, blocchi personalizzati |
| Mappe | Leaflet (`CRS.Simple`) | Mappe da immagine con zoom e pin |
| Traduzioni | File JSON per lingua | Traducibile senza toccare il codice |
| Ricerca | SQLite FTS5 / PostgreSQL full-text | Nessun servizio esterno |
| Distribuzione | Immagine Docker + `docker compose` | Un comando per avviare |

## 3. Utenti e permessi

### Ruoli
| Ruolo | Cosa può fare |
|---|---|
| **Admin** | Tutto: impostazioni, utenti, temi, plugin, backup, esportazioni |
| **Master** | Crea e modifica tutte le pagine, vede e scrive i contenuti segreti, gestisce mappe, cronologie e template |
| **Giocatore** | Legge le pagine per giocatori, modifica quelle consentite (es. il proprio personaggio, i resoconti), usa la bacheca |
| **Visitatore** | Solo lettura delle pagine pubbliche (accesso anonimo attivabile o disattivabile) |

Un utente può essere Admin e Master insieme.

### Visibilità
Ogni **pagina** e ogni **singolo blocco** ha una visibilità:
- `pubblica` — anche i visitatori
- `giocatori` — utenti registrati
- `master` — solo Master e Admin
- `personale` — solo l'autore (es. appunti privati di un giocatore)

Così una pagina "Locanda del Grifone" può avere la descrizione pubblica e, nello stesso testo, un blocco segreto "Il locandiere è una spia".

### Accesso
- Utente + password (hash Argon2), sessioni con cookie sicuri.
- Inviti via link generati dall'Admin (niente registrazione aperta di default).
- Predisposizione per accesso esterno (OIDC: Google, Discord…) come plugin futuro.

## 4. Pagine

### Struttura
- Titolo, indirizzo leggibile (`/wiki/locanda-del-grifone`), contenuto a blocchi, categoria, tag, immagine della pagina (riquadro in alto a destra), visibilità.
- **Cronologia delle modifiche** per ogni pagina, con confronto e ripristino.
- Cestino con recupero.

### Editor a blocchi + Markdown
- Blocchi base: paragrafo, titoli, elenchi, citazione, tabella, immagine, separatore, codice, riquadro (nota/attenzione).
- Blocchi GdR: **statblock**, **scheda PNG**, **tiro di dado** (`2d6+3` cliccabile), **segreto del Master**, **citazione di regola**.
- Scorciatoie Markdown mentre si scrive (`# `, `- `, `**grassetto**`…).
- Le pagine si salvano come JSON di blocchi e si esportano anche in Markdown.

### Collegamenti
- `[[Nome pagina]]` con autocompletamento; `[[Nome pagina|testo]]` per cambiare il testo.
- Collegamento a pagina inesistente = link rosso, cliccando la si crea.
- **Backlink**: ogni pagina mostra chi la cita.
- Anteprima al passaggio del mouse (e tocco prolungato su telefono).

### Tipi di pagina
Tutto ciò che si scrive è una pagina, nell'albero a sinistra e all'indirizzo `/wiki/…`. Le pagine hanno un tipo:
- **pagina**: bianca, oppure fotocopiata da un template;
- **template**: una pagina da fotocopiare, con la struttura base (blocchi, colonna a lato, icona) decisa da chi la scrive;
- **mappa**: una pagina con un'immagine, pin e livelli (vedi §6);
- **cronologia**: una pagina con eventi in ordine di data (vedi §8).

### Template
- Alla creazione della wiki diventano pagine «template» della cartella **Template**: PNG, Personaggio giocante, Luogo, Fazione, Oggetto, Divinità, Mostro, Resoconto di sessione, Regola della casa. Da lì sono pagine come le altre: si modificano, si eliminano, se ne aggiungono.
- Una pagina nuova è bianca o la fotocopia di un template: blocchi, colonna a lato (es. "Allineamento", "Luogo di residenza" collegato a una pagina) e icona. Cambiare il template non cambia le copie già fatte.

## 5. Categorie e tag

- **Categorie** gerarchiche (es. Luoghi › Regni › Città); ogni pagina ne ha una.
- **Tag** liberi, multipli, con colore.
- Pagina indice per categoria e per tag, filtri combinati, ricerca nel testo.

## 6. Mappe

- Ogni mappa è una pagina di tipo «mappa»: titolo, testo, cartella, tag e visibilità sono quelli della pagina.
- Importazione di un'immagine (PNG/JPG/WebP), anche molto grande: il server la divide in tasselli per uno zoom fluido.
- **Pin** con icona, colore, etichetta e collegamento a una pagina.
- **Livelli** (es. città, dungeon, percorsi) attivabili; livelli e pin possono essere visibili solo al Master.
- Mappe annidate: un pin può aprire un'altra mappa (regno → città → edificio).
- Scala e misura delle distanze opzionali.

## 7. Riferimenti alle regole

- Il sistema di regole è un **modulo** (`ruleset`); il primo è **D&D 5.5 (2024)**.
- Sintassi nel testo: `@incantesimo[Palla di fuoco]`, `@mostro[Goblin]`, `@condizione[Prono]`, `@oggetto[...]`, `@regola[...]`.
- Il riferimento diventa un **link alla pagina di D&D Beyond** corrispondente.
- Se il contenuto è nell'**SRD 5.2** (licenza CC-BY-4.0), al passaggio del mouse compare il testo con l'attribuzione richiesta.
- D&D Beyond non offre API pubbliche e i suoi contenuti sono protetti: **nessun contenuto viene copiato da D&D Beyond**, solo collegamenti.
- Le **regole della casa** sono pagine normali (template "Regola della casa") che possono sostituire o annotare un riferimento.
- Altri sistemi (Pathfinder, OSR…) si aggiungono come nuovi moduli.

## 8. Cronologie

- Ogni cronologia è una pagina di tipo «cronologia», e se ne fanno quante se ne vogliono. Ognuna è **del mondo** (storia, ere, leggende) o **della campagna** (cosa è successo al tavolo); alla creazione della wiki ce n'è una per tipo.
- **Calendario personalizzabile**: nomi e durata dei mesi, giorni della settimana, ere, feste, lune. Calendari preimpostati (gregoriano, Harptos dei Forgotten Realms come esempio).
- Eventi con data (anche approssimata: "circa 300 anni fa"), descrizione, pagine collegate, visibilità.
- I **resoconti di sessione** aggiungono in automatico una voce alle cronologie della campagna (data reale + data nel mondo).
- Vista a linea orizzontale e vista elenco (più accessibile).

## 9. Bacheca appunti

- Bacheche a colonne (tipo Kanban) o libere (tipo sughero).
- Bacheca **personale** di ogni utente e bacheche **condivise** del gruppo (es. "Indizi", "Missioni aperte", "Domande per il Master").
- Schede con testo Markdown, colore, collegamenti a pagine; trascinabili anche da tastiera.

## 10. Temi

- Temi preinstallati: **Chiaro** e **Scuro** (o **Automatico**, che segue il sistema).
- Ogni tema è un file JSON di variabili (colori, font, arrotondamenti, ombre), applicate come CSS custom properties.
- Aspetto di base: **angoli vivi** ovunque (`--radius: 0`), **Inter** per il testo e **Archivo** per i titoli (inclusi nella wiki, nessun servizio esterno), **icone a tratto** di un solo colore su una griglia 24×24, le stesse per pagine, cartelle, editor, mappe e pulsanti (`src/lib/icons.ts`, componente `Icon`); nei `::before` le stesse icone come maschere CSS.
- **Editor di temi** per l'Admin con anteprima; il salvataggio è bloccato se i contrasti non rispettano WCAG AA.
- Temi importabili ed esportabili come file.
- Ogni utente sceglie il proprio tema tra quelli installati.

## 11. Lingue

- Interfaccia in **italiano** e **inglese**; lingua scelta per utente, predefinita dall'Admin.
- Testi in `locales/<lingua>.json`; una lingua nuova = un file nuovo, nessuna modifica al codice.
- Le lingue mancanti ricadono sull'inglese.
- I contenuti della wiki restano nella lingua in cui sono scritti (traduzione delle pagine: possibile plugin futuro).

## 12. Accessibilità (WCAG 2.2 AA)

- Testo base 16px minimo, **dimensione regolabile** dall'utente (fino al 200% senza perdere funzioni).
- Contrasto minimo 4.5:1 per il testo, 3:1 per elementi grafici; controllato automaticamente sui temi.
- Uso completo da **tastiera**, focus sempre visibile, link "salta al contenuto".
- Struttura semantica (titoli, landmark, etichette) per i **lettori di schermo**; ARIA solo dove serve.
- Opzioni utente: **font ad alta leggibilità** (es. Atkinson Hyperlegible, OpenDyslexic), **riduci movimento**, interlinea ampia.
- Informazioni mai affidate al solo colore (es. link rossi anche sottolineati tratteggiati).
- Bersagli toccabili di almeno 24×24px (44×44 consigliati), layout funzionante su telefono.
- Ogni mappa e cronologia ha anche una vista a elenco.
- Test automatici con axe-core più verifiche manuali.

## 13. Esportazione, importazione e "pacchetto mondo"

### Backup completo
- Un comando/pulsante produce un archivio con database e file caricati; ripristino nella stessa o in un'altra installazione.

### Pacchetto mondo (`.shelf`)
Per riusare un mondo in un'altra campagna. È uno zip con Markdown, immagini e JSON leggibili anche senza Crooked Shelf.

L'Admin sceglie cosa includere:
- mappe con pin e livelli
- regole della casa
- template e categorie
- tema
- calendario e cronologia del mondo
- pagine singole o intere categorie/tag

Esclusi di default: utenti e password, resoconti di sessione, cronologia della campagna, bacheche, contenuti `personale`. I contenuti segreti del Master sono esclusi di default ma includibili.

In importazione: anteprima, gestione dei conflitti (pagina già esistente → salta / rinomina / sostituisci).

### Export Markdown
- Esportazione dell'intera wiki in cartelle Markdown, compatibile con altri strumenti (es. Obsidian).

## 14. Estensioni (plugin)

Predisposte fin dall'inizio, anche se il caricamento di plugin esterni arriva nella fase 4.
- Punti di estensione: **tipi di blocco**, **template**, **moduli di regole**, **temi**, **pannelli laterali**, **azioni di esportazione**, **lingue**.
- Ogni plugin dichiara nome, versione, permessi richiesti e punti di estensione in un `plugin.json`.
- Le funzioni interne (es. il modulo D&D 5.5) usano la stessa interfaccia dei plugin, così l'API è sempre collaudata.
- Plugin attivabili/disattivabili dall'Admin.

## 15. Self-hosting e alternative

- **Docker** (consigliato): `docker compose up -d`, dati in un volume.
- **Node.js diretto**: per chi non usa Docker.
- **Raspberry Pi**: immagine multi-architettura (ARM64).
- **VPS / cloud**: guida con reverse proxy (Caddy) e HTTPS automatico.
- **PostgreSQL** al posto di SQLite per installazioni grandi.
- Archiviazione file su disco (predefinita) o compatibile S3 (opzionale).
- Nessuna dipendenza da servizi esterni obbligatori; funziona anche in rete locale senza internet (tranne i link a D&D Beyond).
- GitHub Pages (`yanez86.github.io/crooked-shelf`) può ospitare solo la pagina di presentazione e la documentazione, non la wiki.

## 16. Fasi di sviluppo

1. **Fondamenta**: struttura del progetto, database, accesso e ruoli, pagine con editor a blocchi, collegamenti e backlink, categorie e tag, ricerca, IT/EN, temi preinstallati, accessibilità di base.
2. **Mondo**: template, mappe con pin e livelli, cronologie con calendari personalizzati, resoconti di sessione.
3. **Al tavolo**: bacheca appunti, riferimenti alle regole (D&D Beyond + SRD 5.2), editor dei temi, cronologia delle modifiche.
4. **Apertura**: sistema di plugin, Docker multi-architettura, backup, pacchetto mondo `.shelf`, export Markdown, documentazione utente e sviluppatore.

Ogni fase si chiude con test automatici (unità, interfaccia con Playwright, accessibilità con axe-core) e una verifica su computer e telefono.

## 17. Licenza

- Codice: **GNU AGPL-3.0** (file `LICENSE`). Chi distribuisce o offre online una versione modificata deve renderne disponibile il codice.
- L'interfaccia mostrerà un link "Codice sorgente", come richiesto dalla AGPL.
- I contenuti scritti dagli utenti nella wiki appartengono a loro.
- Testi SRD 5.2: CC-BY-4.0 di Wizards of the Coast, con attribuzione visibile.
- D&D, D&D Beyond e relativi marchi appartengono ai rispettivi proprietari; il progetto non è affiliato.

## 18. Note sulla fase 2

- Le immagini caricate hanno un indirizzo casuale non indovinabile (`/files/<id>`): chi non vede la pagina o la mappa non può risalirci. Formati: PNG, JPEG, WebP, GIF (niente SVG, che può contenere codice), massimo 25 MB.
- Le mappe sono mostrate intere (non ancora divise in tasselli): per immagini molto grandi la divisione in tasselli resta un miglioramento futuro.
- Le lune del calendario non sono ancora gestite.
- Ordine della cronologia della campagna: per data reale (l'ordine in cui si è giocato), poi per data nel mondo.
- Chi può aggiungere eventi: nella cronologia del mondo Master e Admin; in quella della campagna anche i giocatori (non come "Solo Master").

## 19. Note sulla fase 3

- Riferimenti alle regole: `@tipo[Nome inglese|testo mostrato]`; tipi in inglese o italiano (incantesimo, mostro, condizione, oggetto, talento, specie, classe, background, regola). Il link porta alla ricerca di D&D Beyond, che non ha un'API pubblica.
- Testi SRD 5.2 solo in inglese (999 voci), ricavati dal progetto 5e-database con `tools/import-srd.mjs`; attribuzione in `THIRD_PARTY_NOTICES.md` e nell'interfaccia.
- Le pagine che citano una regola compaiono nella sua scheda e nell'anteprima: così le regole della casa sono collegate alle regole ufficiali.
- Versioni: ogni salvataggio crea una versione. Chi guarda vede solo le versioni di quando la pagina era visibile per lui, e i segreti solo se è Master.
- Bacheche: sono pagine «bacheca» (tabella `boards` con `page_id`), con la visibilità della pagina (le personali sono pagine `personale`). Chi vede la pagina e ha fatto l'accesso aggiunge e sposta schede; le colonne le gestisce chi può modificare la pagina. Le vecchie bacheche sono state convertite dalla migrazione della 0.11 nella cartella Bacheche; i vecchi indirizzi `/boards/<id>` rimandano alla pagina.
- Temi personalizzati: salvati nelle impostazioni, accettati solo se tutti i contrasti WCAG AA sono rispettati, anche quando importati da file.

## 20. Note sulla fase 4

- Plugin di **soli dati** (temi, template, calendari, lingue, regole): nessun codice eseguito, quindi nessun rischio per il server. Tipi di blocco e pannelli nuovi richiederebbero codice: restano un possibile sviluppo futuro.
- Backup completo in un file .zip (database copiato in modo coerente anche a wiki accesa, immagini, plugin); ripristino con `tools/restore.mjs`, che non cancella il database esistente ma lo rinomina.
- Pacchetto mondo `.shelf`: zip con `manifest.json`, `pages.json` (più una copia `.md` leggibile per pagina), `categories.json`, `maps.json`, `templates.json`, `calendar.json`, `timeline.json`, `themes.json`, `files/`. All'importazione i collegamenti tra pagine rinominate e gli indirizzi delle immagini vengono aggiornati.
- Esportazione Markdown compatibile con Obsidian: una cartella per categoria, intestazione YAML, `[[collegamenti]]`, callout `> [!note]`.
- Docker: immagine Node 22 (amd64 e arm64), volume `/data`, controllo di salute; GitHub Actions per i test e per pubblicare l'immagine su ghcr.io a ogni versione.

## 21. Note su albero, risorse, immagine della pagina e galleria

- **Albero a sinistra** (come Esplora risorse) in tutti i temi: le categorie sono cartelle che si aprono e si chiudono, sotto ci sono le pagine di ogni tipo, con l'icona scelta o quella del tipo; le pagine senza categoria stanno alla radice. Si apre da sola la cartella della pagina che stai leggendo; le cartelle aperte a mano sono ricordate nel browser. Sta nella barra a sinistra (vedi §22). Mostra solo le pagine che chi guarda può vedere; le cartelle vuote solo a Master e Admin; nessun titolo a chi non ha fatto l'accesso se i visitatori sono spenti. Sul telefono sta sopra la pagina, chiuso in un pulsante. In alto due linguette, **Pagine** e **Risorse** (tablist ARIA, frecce per passare dall'una all'altra): si apre quella di ciò che stai guardando, altrove resta l'ultima scelta.
- **Risorse**: immagini, audio (MP3, OGG, WAV, FLAC, M4A) e qualsiasi altro file della campagna, nella seconda linguetta dell'albero (divise per tipo) e nella pagina `/resources`. Le carica il Master; chi le vede si sceglie come per le mappe (pubblica, giocatori, solo Master). Il tipo si riconosce dai primi byte del file: immagini e audio si aprono nel browser, tutto il resto (PDF compresi) si scarica sempre come allegato, così un file caricato non può eseguire script. I file si consegnano a pezzi (`Range`), che serve per saltare avanti nell'audio e a Safari su iPhone per suonarlo. Al massimo 90 MB (le immagini restano a 25 MB). Cambiando o eliminando una risorsa il suo file sparisce anche dal disco. Entrano nel backup e, se sono immagini, nella galleria; non ancora nel pacchetto mondo.
- **Colonna a lato**: di base non c'è, né in lettura né in modifica. In modifica il «+» la aggiunge; dentro ci sono riquadri di **testo** (titolo e valore, con `[[collegamenti]]`) o **immagine** (con didascalia), da riordinare con le frecce. Si salvano con la pagina (nei campi, quindi anche nelle versioni); l'immagine si carica subito (`/api/files`) e si può trascinare sul riquadro. La prima immagine è l'immagine della pagina (galleria, anteprima dei collegamenti). Entrano nel pacchetto mondo e nell'esportazione Markdown (le immagini in cima al testo). L'immagine della pagina di prima è diventata il primo riquadro.
- **Copertina e icona** (come in Notion): in cima alla pagina una copertina facoltativa, un'immagine o una tinta unita (sei colori fissi, uguali in tutti i temi), con l'icona della pagina a cavallo del bordo; senza copertina l'icona sta sopra il titolo. In modifica è uguale, e sul lato della copertina tre piccole icone la cambiano, la riposizionano e la tolgono; il pannello di scelta ha tre schede: Galleria (`/api/gallery`, solo le immagini che chi scrive può vedere), Tinta unita, Carica (`/api/files`). Riposizionare è un cursore ARIA: si trascina l'immagine o si usano le frecce, e si salva la posizione verticale (0–100, `object-position`). Si salva nelle colonne `cover_image_id`, `cover_color`, `cover_y` delle pagine, fuori dalle versioni (come l'icona); entra nella galleria, nel pacchetto mondo e nell'esportazione Markdown (in cima al testo).
- **Galleria**: tutte le immagini della campagna (copertine e immagini delle pagine, immagini nel testo, mappe, risorse), le più recenti prima, con il visore a schermo intero (frecce per scorrere, Esc per chiudere). Ognuno vede solo le immagini di pagine, mappe e risorse che può vedere; quelle dentro i segreti solo il Master. Le miniature sono le immagini originali caricate in ritardo: generare miniature più leggere resta un miglioramento futuro.

## 22. Note sui tipi di pagina e sulla barra a sinistra

- **Una sola barra di navigazione**, a sinistra: in alto «Nuova pagina», poi l'albero con le linguette Pagine e Risorse. Le altre sezioni (Pagine, Tag, Galleria, Regole, Calendario, Cartelle, Cestino) stanno nel menu del profilo in alto a destra. «Nuova cartella» crea la cartella direttamente nell'albero, col nome da scrivere (API `POST /api/categories`). «Nuova pagina» propone prima i tipi (pagina bianca, bacheca, cronologia, template, mappa) e poi le fotocopie dei template. La barra orizzontale sotto l'intestazione non c'è più. Di base la barra sta aperta accanto alla pagina; dal Profilo si può tenere chiusa (si apre col pulsante in alto, come sul telefono). In Profilo e Amministrazione è chiusa.
- **Tipo nel database**: colonna `kind` delle pagine (`page`, `template`, `map`, `timeline`). La mappa ha la sua riga in `maps` (immagine, scala, mappa che la contiene) legata alla pagina; la cronologia ha il suo modo in `timelines` (`world` o `campaign`); gli eventi stanno nella loro cronologia (`timeline_events.timeline_id`), tranne le voci dei resoconti di sessione, che compaiono in tutte le cronologie della campagna.
- **Chi crea cosa**: le pagine chiunque abbia fatto l'accesso; template, mappe e cronologie il Master. Pagina e template si scambiano con la casella «È un template» (solo il Master); mappe e cronologie restano del loro tipo.
- **Fotocopia**: alla nuova pagina passano blocchi, colonna a lato e icona del template (i segreti solo se chi crea è Master); se il template è di resoconti, anche i dati di sessione con la data di oggi. La pagina ricorda da quale template viene (colonna `template`), solo per informazione.
- **Template dei plugin**: accendendo un plugin i suoi template diventano pagine della cartella Template, una volta sola; restano anche a plugin spento.
- **Aggiornamento di una wiki esistente** (migrazione): ogni mappa diventa una pagina nella cartella Mappe (con lo stesso indirizzo se è libero, e la descrizione come testo); le due cronologie diventano due pagine con i loro eventi; i template del Master e quelli preinstallati diventano pagine della cartella Template. I vecchi indirizzi `/maps/…`, `/timeline/…` e `/templates` portano alle pagine nuove.
- **Pacchetto mondo**: versione 2, le mappe (con pin e livelli), le cronologie del mondo (con gli eventi) e i template sono pagine di `pages.json` con il loro tipo; i pacchetti di versione 1 (`maps.json`, `timeline.json`, `templates.json`) si importano ancora. Nell'esportazione Markdown la mappa va in cima alla pagina e gli eventi in fondo, in elenco.

## 23. Decisioni prese

- Il nome **Crooked Shelf** resta anche nell'interfaccia italiana.
- L'accesso dei **visitatori** è **spento** di default; l'Admin può attivarlo.
- I **giocatori possono creare pagine nuove**; modificano le proprie e quelle segnate come "modificabili dai giocatori". Le pagine che contengono blocchi segreti del Master le modificano solo Master e Admin, così un giocatore non cancella per errore un segreto che non vede.
- Le preferenze di lettura (tema, dimensione del testo, font, movimento, lingua) sono salvate nel profilo; per chi non ha fatto l'accesso restano nel browser.
- **Profilo** in alto a destra: icona, nome e grado dell'utente; si apre un menu (un `<details>`, che funziona anche senza JavaScript) con Profilo, Amministrazione ed Esci. La pagina `/profile` raccoglie preferenze, icona (una delle icone delle pagine; senza scelta, la sagoma di una persona), nome visualizzato e password; `/preferences` rimanda lì.
