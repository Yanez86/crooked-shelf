# Installare Crooked Shelf

Crooked Shelf è un programma che resta acceso su un computer (il "server") e si usa dal browser, anche dal telefono. Il computer può essere il tuo PC, un Raspberry Pi in casa o un server affittato su internet.

Tutti i dati (database, immagini, plugin installati) stanno in **una sola cartella**: per il backup basta quella.

## 1. Con Docker (consigliato)

Serve [Docker](https://docs.docker.com/get-docker/) (su Windows e Mac: Docker Desktop).

```bash
git clone https://github.com/yanez86/crooked-shelf.git
cd crooked-shelf
docker compose up -d
```

Apri **http://localhost:3000**. La prima volta si crea la wiki e l'account amministratore: la pagina chiede il **codice di configurazione**, che trovi in `docker compose logs` (serve perché la wiki la configuri tu, non chi arriva prima all'indirizzo). In alternativa scegli tu il codice con la variabile `CS_SETUP_TOKEN`.

Dagli altri dispositivi di casa usa l'indirizzo del computer, per esempio `http://192.168.1.20:3000`.

Comandi utili:

| Cosa | Comando |
|---|---|
| Fermare | `docker compose stop` |
| Riavviare | `docker compose start` |
| Vedere i messaggi | `docker compose logs -f` |
| Aggiornare a una nuova versione | `git pull` e poi `docker compose up -d --build` |

I dati stanno nel volume Docker `crooked-shelf-data` e sopravvivono agli aggiornamenti.

Se durante la costruzione Docker risponde **"Too Many Requests"**, usa un'altra copia dell'immagine di Node:

```bash
docker compose build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm-slim
docker compose up -d
```

### Raspberry Pi

Funziona su Raspberry Pi 4 o 5 con sistema a 64 bit (Raspberry Pi OS 64-bit): i passi sono gli stessi. La prima costruzione richiede qualche minuto.

## 2. Senza Docker

Serve [Node.js](https://nodejs.org/) 22.17 o più recente.

```bash
git clone https://github.com/yanez86/crooked-shelf.git
cd crooked-shelf
npm ci
npm run build
npm start
```

I dati vanno nella cartella `data` accanto al programma (si cambia con `CS_DATA_DIR`).

Per farlo ripartire da solo all'accensione del computer si può usare `systemd` (Linux), `pm2` o il Task Scheduler di Windows.

## 3. Su internet, con HTTPS

Per rendere la wiki raggiungibile da fuori casa servono un server sempre acceso con un IP pubblico (per esempio un piccolo VPS da pochi euro al mese) e un dominio (es. `wiki.esempio.it`). Nel repository c'è già tutto il necessario: `docker-compose.prod.yml` avvia la wiki insieme a [Caddy](https://caddyserver.com/), che gestisce HTTPS e ottiene e rinnova da solo il certificato.

Il server deve avere almeno 2 GB di RAM (per costruire l'immagine) e le porte **80** e **443** aperte, sia nel firewall del fornitore sia in quello del sistema.

1. Dal sito dove hai comprato il dominio, crea un record **A** (es. `wiki`) che punta all'IP del server.
2. Sul server installa Docker e scarica Crooked Shelf:

   ```bash
   curl -fsSL https://get.docker.com | sh
   git clone https://github.com/yanez86/crooked-shelf.git /opt/crooked-shelf
   cd /opt/crooked-shelf
   ```

3. Scrivi il dominio nel file `.env`:

   ```bash
   cp .env.example .env
   nano .env          # CS_DOMAIN=wiki.esempio.it
   ```

4. Avvia:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. Apri `https://wiki.esempio.it` e crea la wiki e l'account amministratore col codice di configurazione che leggi in `docker compose -f docker-compose.prod.yml logs crooked-shelf`.

La wiki non è esposta direttamente: dall'esterno si passa solo da Caddy, e `CS_ORIGIN` e `CS_TRUST_PROXY` sono già impostati.

| Cosa | Comando |
|---|---|
| Vedere i messaggi | `docker compose -f docker-compose.prod.yml logs -f` |
| Aggiornare a una nuova versione | `git pull` e poi `docker compose -f docker-compose.prod.yml up -d --build` |
| Fermare | `docker compose -f docker-compose.prod.yml stop` |

Consigli per una wiki affidabile:

- attiva i **backup automatici del server** offerti dal fornitore e, ogni tanto, scarica anche il backup della wiki (vedi [Backup e ripristino](#backup-e-ripristino)) su un disco tuo;
- accedi al server con una chiave SSH e lascia che il sistema installi da solo gli aggiornamenti di sicurezza (su Ubuntu: `apt install unattended-upgrades`).

Se usi già un altro proxy (nginx, Caddy installato a mano…), resta valido `docker-compose.yml`: punta il proxy a `localhost:3000` e togli il `#` da queste righe:

```yaml
CS_ORIGIN: "https://wiki.esempio.it"
CS_TRUST_PROXY: "1"
```

In quel caso cambia anche `"3000:3000"` in `"127.0.0.1:3000:3000"`: così la wiki risponde solo al proxy, e nessuno la raggiunge in `http` saltando l'HTTPS. Con `CS_ORIGIN` in `https` la wiki manda da sola l'intestazione `Strict-Transport-Security`; il proxy deve passare `X-Forwarded-For` (e `X-Forwarded-Proto`), altrimenti i limiti ai tentativi di accesso valgono per tutti i visitatori insieme: la wiki lo segnala nei log se le intestazioni non tornano.

L'accesso dei visitatori senza account è **spento** di default: finché non lo accendi, sulla wiki entra solo chi ha ricevuto un invito.

## 4. Provarla online gratis, con Render

Per dare un'occhiata alla wiki da fuori casa senza un server tuo c'è [Render](https://render.com/): il file `render.yaml` è già pronto.

1. Accedi a Render con GitHub.
2. **New › Blueprint**, scegli il repository e conferma.
3. Finita la costruzione, apri l'indirizzo `https://crooked-shelf-….onrender.com` e crea la wiki e l'account amministratore col codice di configurazione che leggi nei log di Render (o che imposti tu in `CS_SETUP_TOKEN` tra le variabili del servizio).

A ogni modifica su `main` Render costruisce e pubblica da solo la nuova versione.

Sul piano gratuito:

- dopo 15 minuti senza visite la wiki si spegne, e alla visita successiva ci mette fino a un minuto a ripartire;
- **i dati non restano**: a ogni spegnimento, riavvio o nuova versione si riparte da una wiki vuota.

Va bene per provarla, non per giocarci una campagna: per quello usa uno dei modi qui sopra.

## Impostazioni

| Variabile | Significato | Predefinito |
|---|---|---|
| `PORT` | porta | `3000` |
| `HOST` | indirizzo su cui ascoltare | `0.0.0.0` |
| `CS_DATA_DIR` | cartella dei dati | `./data` (in Docker `/data`) |
| `CS_ORIGIN` | indirizzo pubblico, es. `https://wiki.esempio.it` | — |
| `CS_TRUST_PROXY` | `1` dietro un proxy che invia `X-Forwarded-*` | — |
| `CS_PLUGINS_BUNDLED` | cartella dei plugin inclusi | `./plugins` |
| `CS_UPDATE_CHECK` | `0` = non controllare su GitHub se c'è una versione nuova | — |
| `CS_SETUP_TOKEN` | il codice della prima configurazione; senza, la wiki ne genera uno e lo scrive nei log | — |
| `CS_UPLOAD_QUOTA_MB` | spazio per le immagini di ogni account giocatore (Master e Admin non hanno limite) | `512` |
| `CS_PACK_MAX_MB` | dimensione massima, decompressa, di un pacchetto mondo da importare | `200` |
| `TZ` | fuso orario del tavolo, es. `Europe/Rome`: decide «oggi» e quando un appuntamento salta | quello del sistema (`docker-compose.yml`: `Europe/Rome`) |

Senza `CS_ORIGIN` la wiki usa l'indirizzo con cui viene raggiunta, in `http`: così funziona subito in rete locale.

In Amministrazione › Impostazioni la wiki confronta la sua versione con quella del `package.json` sul ramo `main` di GitHub. Il server lo legge solo quando un Admin apre la pagina, al massimo una volta all'ora, e non manda nulla della wiki; con `CS_UPDATE_CHECK=0` non contatta GitHub.

## Backup e ripristino

**Backup**: Amministrazione › Backup › «Scarica il backup». Il file contiene database, immagini e plugin installati, in chiaro: contiene tutto, segreti di ogni campagna e password cifrate comprese. Conservalo su un altro disco, al sicuro.

**Ripristino senza Docker** (wiki ferma):

```bash
node tools/restore.mjs crooked-shelf-backup-2026-10-29.zip ./data --force
```

**Ripristino con Docker**, dalla cartella di Crooked Shelf con il file di backup copiato lì (con `docker-compose.prod.yml` aggiungi `-f docker-compose.prod.yml` dopo ogni `docker compose`):

```bash
docker compose stop
docker compose run --rm -v "$PWD:/backup" crooked-shelf node tools/restore.mjs /backup/crooked-shelf-backup-2026-10-29.zip /data --force
docker compose start
```

Il database che c'era prima non viene cancellato: viene rinominato `crooked-shelf.db.prima-del-ripristino-…`.

Altri modi di portare via i dati (Amministrazione):

- **Esporta in Markdown**: tutte le pagine come file di testo, apribili con Obsidian o qualsiasi editor.
- **Pacchetto mondo** (`.shelf`): mappe, pagine, regole della casa, template, calendario e cronologia del mondo, da importare in un'altra wiki: in una campagna che c'è già oppure in una nuova, creata apposta, che riprende anche la home del pacchetto.

## Sicurezza: cosa sapere

- **L'Admin è chi possiede i dati.** Nelle campagne che non tiene l'interfaccia non gli mostra i segreti del Master, ma può scaricare il backup, creare altri account Admin e nominare Master: è una cortesia tra persone che si fidano, non una barriera. Dai il ruolo Admin solo a chi affideresti il server.
- **Chi può accedere** lo decidono gli inviti: senza invito non ci si registra. I visitatori senza account sono spenti finché non li accendi in Amministrazione › Impostazioni.
- **Limiti**: 20 accessi falliti ogni 10 minuti per indirizzo (e 5 per nome utente), un tetto agli hash delle password in corso, 60 caricamenti di immagini ogni 10 minuti, una quota di spazio per i giocatori. Le immagini si scaricano solo da chi può vedere la pagina (o la risorsa) che le usa; quelle che nessuno usa da un giorno si eliminano da sole.
- **Sessioni**: scadono dopo 30 giorni senza visite e comunque dopo 90 dall'accesso; dal Profilo si chiudono quelle sugli altri dispositivi. Un token di Claude fermo da 90 giorni smette di valere.
- **Password dimenticata**: l'Admin crea un link di reimpostazione da Amministrazione › Utenti, che vale due giorni e una volta sola.
- **Registro**: Amministrazione › Registro elenca accessi, cambi di ruolo e password, inviti, token di Claude e backup degli ultimi sei mesi.
