# Novità

Le versioni seguono il [versionamento semantico](https://semver.org/lang/it/): MAGGIORE.MINORE.CORRETTIVA.
Questo file è anche la pagina «Novità» della wiki (`/changelog`).

## 0.14.0 — 2026-11-04

### Aggiunte
- Segreti del Master su singoli blocchi: il Master oscura o mostra qualunque blocco dall'editor, anche nelle schede giocatore.
- I giocatori modificano anche le pagine che contengono segreti, senza mai vederli.

### Modifiche
- I segreti esistenti si convertono da soli: le pagine si vedono come prima.
- Claude può aggiungere testo segreto.

### Correzioni
- Esportazione in Markdown: le immagini dei segreti non arrivano più a chi non è Master.

## 0.13.0 — 2026-11-04

Versione dedicata alla sicurezza, dopo una revisione completa del codice.

### Aggiunte
- Prima configurazione protetta da un codice, scritto nei log del server.
- Limiti ai tentativi di accesso e alle richieste.
- I file si scaricano solo da chi può vedere dove sono usati.
- Quota di spazio per le immagini dei giocatori.
- Sessioni con scadenza e chiusura di quelle aperte altrove; dopo l'aggiornamento si rifà l'accesso una volta.
- Token di Claude che scadono se non si usano.
- Reimpostazione della password da parte dell'Admin; le password troppo deboli vengono rifiutate.
- Registro delle attività in Amministrazione.
- Intestazioni di sicurezza aggiuntive.

### Modifiche
- Backup e pacchetti mondo usano meno memoria.
- Documentazione e CI aggiornate sulla sicurezza.

### Correzioni
- Dopo l'accesso non si viene più portati fuori dalla wiki.

## 0.12.4 — 2026-11-04

### Aggiunte
- Appuntamenti: anche il Master indica se gioca in presenza o da remoto.

### Correzioni
- Home: corretta la risposta del Master nella prossima sessione.

## 0.12.3 — 2026-11-04

### Aggiunte
- Barra a sinistra: linguetta Tag.

### Modifiche
- Appuntamenti: avatar accanto ai nomi.

## 0.12.2 — 2026-11-03

### Aggiunte
- Appuntamenti: dettagli della sessione e risposta in un popup, e chi viene sotto ogni data.
- Home: la prossima sessione e le date ancora senza risposta.
- Stars & Wishes: due domande facoltative dopo ogni sessione, lette solo dal Master.
- Claude come connettore da claude.ai.
- Avatar nel profilo.

### Modifiche
- Campagna e Profilo divisi in schede.

## 0.12.0 — 2026-11-03

### Aggiunte
- Appuntamenti: il calendario delle sessioni di ogni campagna, con date ripetute, risposte dei giocatori e un numero minimo di partecipanti.

## 0.11.1 — 2026-11-03

### Correzioni
- Correzioni di visualizzazione nell'intestazione e nella home.

## 0.11.0 — 2026-11-03

### Aggiunte
- Più campagne nella stessa installazione, ognuna con il suo Master, i suoi giocatori e i suoi contenuti; la wiki esistente diventa la prima campagna.
- Schede giocatore e, in home, chi è al tavolo.
- Temi Lago, Lago di notte e Neon; marchio e icona seguono i colori del tema.
- Plugin per Claude Code.
- Pacchetto mondo importabile in una campagna nuova.
- Controllo degli aggiornamenti in Amministrazione.

### Modifiche
- L'Admin gestisce il sito, ma vede i segreti solo nelle campagne di cui è Master.
- Interfaccia rivista per il telefono.
- Barra a sinistra, albero delle pagine e impaginazione riorganizzati.
- La home e le bacheche diventano pagine della wiki.
- Pulsanti e popup uniformi; collegamenti, Profilo e Amministrazione si aprono in un popup.
- Editor, mappe e risorse più semplici da usare.
- Temi con immagine di sfondo.
- D&D Beyond diventa un plugin incluso, spento di base: chi lo usava lo riaccende da Amministrazione › Plugin.

### Correzioni
- Correzioni di visualizzazione sul telefono e nella navigazione da tastiera.

## 0.10.0 — 2026-10-29

### Aggiunte
- Pagina «Novità» con l'elenco delle versioni.
- Comandi per aprire, chiudere e creare cartelle nell'albero.

## 0.9.0 — 2026-10-29

### Aggiunte
- Wiki con accesso, ruoli, editor a blocchi, collegamenti, categorie, tag, ricerca, italiano e inglese, temi accessibili.
- Template, immagini, mappe, cronologie con calendari personalizzati.
- Regole SRD 5.2, bacheche, versioni delle pagine, cestino, editor dei temi.
- Plugin, backup, pacchetto mondo, esportazione in Markdown, Docker.
- Albero delle cartelle e delle pagine, immagine della pagina, galleria.

### Modifiche
- Revisione grafica dell'interfaccia.
