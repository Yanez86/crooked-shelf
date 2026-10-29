# Crooked Shelf — Documento di progetto

Wiki self-hosted per creare, curare e registrare campagne di giochi di ruolo da tavolo (pensata per D&D 5.5, aperta ad altri sistemi).

> Stato: **bozza da approvare**. Nessuna riga di codice viene scritta prima dell'approvazione di questo documento.

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
- Titolo, indirizzo leggibile (`/wiki/locanda-del-grifone`), contenuto a blocchi, categoria, tag, immagine di copertina, visibilità.
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

### Template
- Preinstallati: PNG, Personaggio giocante, Luogo, Fazione, Oggetto, Divinità, Mostro, Resoconto di sessione, Regola della casa.
- Template creati da Master/Admin, con campi strutturati (es. "Allineamento", "Luogo di residenza" collegato a una pagina).

## 5. Categorie e tag

- **Categorie** gerarchiche (es. Luoghi › Regni › Città); ogni pagina ne ha una.
- **Tag** liberi, multipli, con colore.
- Pagina indice per categoria e per tag, filtri combinati, ricerca nel testo.

## 6. Mappe

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

- Due cronologie: **del mondo** (storia, ere, leggende) e **della campagna** (cosa è successo al tavolo).
- **Calendario personalizzabile**: nomi e durata dei mesi, giorni della settimana, ere, feste, lune. Calendari preimpostati (gregoriano, Harptos dei Forgotten Realms come esempio).
- Eventi con data (anche approssimata: "circa 300 anni fa"), descrizione, pagine collegate, visibilità.
- I **resoconti di sessione** aggiungono in automatico una voce alla cronologia della campagna (data reale + data nel mondo).
- Vista a linea orizzontale e vista elenco (più accessibile).

## 9. Bacheca appunti

- Bacheche a colonne (tipo Kanban) o libere (tipo sughero).
- Bacheca **personale** di ogni utente e bacheche **condivise** del gruppo (es. "Indizi", "Missioni aperte", "Domande per il Master").
- Schede con testo Markdown, colore, collegamenti a pagine; trascinabili anche da tastiera.

## 10. Temi

- Temi preinstallati: **Chiaro**, **Scuro**, **Pergamena**, **Alto contrasto**.
- Ogni tema è un file JSON di variabili (colori, font, arrotondamenti, ombre), applicate come CSS custom properties.
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

## 18. Domande ancora aperte

- Nome e logo definitivi ("Crooked Shelf" va bene anche nell'interfaccia italiana?).
- Accesso visitatori attivo o spento di default?
- I giocatori possono creare pagine nuove o solo modificare quelle consentite?
