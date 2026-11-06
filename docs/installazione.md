# Installare Crooked Shelf

Crooked Shelf resta acceso su un computer (il "server") e si usa dal browser, anche dal telefono. Il server può essere il tuo PC, un Raspberry Pi o un server affittato su internet.

Tutti i dati (database, immagini, plugin) stanno in **una sola cartella**: per il backup basta quella.

## 1. Con Docker (consigliato)

Serve [Docker](https://docs.docker.com/get-docker/) (su Windows e Mac: Docker Desktop).

```bash
git clone https://github.com/yanez86/crooked-shelf.git
cd crooked-shelf
docker compose up -d
```

Apri **http://localhost:3000** e crea la wiki e l'account amministratore. La pagina chiede il **codice di configurazione**, che trovi in `docker compose logs`: così la configuri tu, e non chi arriva prima all'indirizzo. Il codice puoi sceglierlo tu con `CS_SETUP_TOKEN`.

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

Su Raspberry Pi 4 o 5 con sistema a 64 bit (Raspberry Pi OS 64-bit) i passi sono gli stessi. La prima costruzione richiede qualche minuto.

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

Per farlo partire all'accensione: `systemd` (Linux), `pm2` o il Task Scheduler di Windows.

## 3. Su internet, con HTTPS

Da fuori casa servono un server sempre acceso con un IP pubblico (un piccolo VPS da pochi euro al mese) e un dominio (es. `wiki.esempio.it`). `docker-compose.prod.yml` avvia la wiki con [Caddy](https://caddyserver.com/), che gestisce HTTPS e rinnova da solo il certificato.

Il server deve avere almeno 2 GB di RAM (per costruire l'immagine) e le porte **80** e **443** aperte, nel firewall del fornitore e in quello del sistema.

1. Dove hai comprato il dominio, crea un record **A** (es. `wiki`) verso l'IP del server.
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

Consigli:

- attiva i **backup del server** del fornitore e il [backup automatico](#backup-automatico) della wiki, magari cifrato e copiato altrove con rclone; ogni tanto scarica un backup su un disco tuo;
- accedi al server con una chiave SSH e fai installare al sistema gli aggiornamenti di sicurezza (su Ubuntu: `apt install unattended-upgrades`).

Se usi già un altro proxy (nginx, Caddy installato a mano…), resta valido `docker-compose.yml`: punta il proxy a `localhost:3000` e togli il `#` da queste righe:

```yaml
CS_ORIGIN: "https://wiki.esempio.it"
CS_TRUST_PROXY: "1"
```

Cambia anche `"3000:3000"` in `"127.0.0.1:3000:3000"`, così la wiki risponde solo al proxy e nessuno salta l'HTTPS. Con `CS_ORIGIN` in `https` la wiki manda da sola `Strict-Transport-Security`. Il proxy deve passare `X-Forwarded-For` (e `X-Forwarded-Proto`), altrimenti i limiti ai tentativi di accesso valgono per tutti i visitatori insieme; se le intestazioni non tornano, la wiki lo scrive nei log.

L'accesso dei visitatori senza account è **spento**: finché non lo accendi, entra solo chi ha un invito.

## 4. Provarla online gratis, con Render

Per provarla senza un server tuo c'è [Render](https://render.com/), con `render.yaml` già pronto.

1. Accedi a Render con GitHub.
2. **New › Blueprint**, scegli il repository e conferma.
3. Finita la costruzione, apri l'indirizzo `https://crooked-shelf-….onrender.com` e crea la wiki e l'account amministratore col codice di configurazione che leggi nei log di Render (o che imposti tu in `CS_SETUP_TOKEN` tra le variabili del servizio).

A ogni modifica su `main` Render pubblica da solo la nuova versione.

Sul piano gratuito:

- dopo 15 minuti senza visite la wiki si spegne, e ci mette fino a un minuto a ripartire;
- **i dati non restano**: a ogni spegnimento, riavvio o nuova versione si riparte da una wiki vuota.

Va bene per provarla, non per giocarci.

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
| `CS_BACKUP_DIR` | cartella dei backup automatici, es. quella di OneDrive (vedi [Backup automatico](#backup-automatico)); deve esistere già | `<CS_DATA_DIR>/backups` |
| `TZ` | fuso orario del tavolo, es. `Europe/Rome`: decide «oggi» e quando un appuntamento salta | quello del sistema (`docker-compose.yml`: `Europe/Rome`) |

Senza `CS_ORIGIN` la wiki usa l'indirizzo con cui viene raggiunta, in `http`: così funziona subito in rete locale.

In Amministrazione › Impostazioni la wiki confronta la sua versione con il `package.json` di `main` su GitHub: lo legge quando un Admin apre la pagina, al massimo una volta all'ora, senza mandare niente della wiki. Con `CS_UPDATE_CHECK=0` non contatta GitHub.

## Backup e ripristino

**Backup**: Amministrazione › Backup › «Scarica il backup». Il file contiene in chiaro database, immagini e plugin: tutto, segreti di ogni campagna e password cifrate comprese. Conservalo al sicuro, su un altro disco.

### Backup automatico

In Amministrazione › Backup l'Admin accende il **backup automatico**: ogni giorno, all'ora scelta (del server), la wiki salva un backup completo in una cartella e tiene gli ultimi 7 (o quanti scegli). Se a quell'ora il computer è spento, parte alla riaccensione; se non riesce, la wiki riprova ogni ora e lo scrive nella pagina e nel Registro. C'è anche «Fai un backup adesso».

I file si chiamano `crooked-shelf-backup-2026-11-05-030000.zip` (`.zip.enc` se cifrati). La wiki cancella solo i suoi backup più vecchi, riconoscendoli dal nome, e non tocca gli altri file. Finché il file è a metà ha un nome provvisorio (`~crooked-shelf-backup-….tmp`).

**Portarli in cloud.** La wiki non si collega a OneDrive, Google Drive o Dropbox: scrive in una cartella, e se è quella del loro programma ci pensa lui a caricarli. La cartella si sceglie con `CS_BACKUP_DIR`; senza, i backup vanno in `backups` nella cartella dei dati, che protegge da un errore ma non da un disco rotto. La cartella deve esistere: se manca (disco staccato, cartella non collegata a Docker) il backup non riesce e la pagina lo dice.

- **Windows, senza Docker** (PowerShell, dalla cartella di Crooked Shelf):

  ```powershell
  mkdir "$env:USERPROFILE\OneDrive\Crooked Shelf"
  $env:CS_BACKUP_DIR = "$env:USERPROFILE\OneDrive\Crooked Shelf"
  npm start
  ```

  Con Google Drive per desktop la cartella è di solito `G:\Il mio Drive\Crooked Shelf`.

- **Docker** (anche Docker Desktop su Windows e Mac): in `docker-compose.yml` togli il `#` dalle righe del backup e scrivi il percorso della cartella sul tuo computer, poi `docker compose up -d`:

  ```yaml
  volumes:
    - crooked-shelf-data:/data
    - "C:/Users/nome/OneDrive/Crooked Shelf:/backups"
  environment:
    CS_BACKUP_DIR: "/backups"
  ```

  Su Linux la cartella deve essere scrivibile dall'utente del container: `sudo chown 1000:1000 /percorso/della/cartella`. I backup li legge solo quell'utente (e root).

- **Su un server (VPS)** collega una cartella come sopra (es. `/opt/crooked-shelf-backup:/backups`) e caricala con [rclone](https://rclone.org/), che funziona con Google Drive, OneDrive e molti altri. Dopo `rclone config`, una riga in `crontab -e` la copia ogni mattina, senza i file a metà:

  ```bash
  30 4 * * * rclone copy /opt/crooked-shelf-backup drive:CrookedShelf --exclude "~*"
  ```

Le copie vecchie che la wiki cancella spariscono anche dal cloud (di solito finiscono nel cestino di OneDrive o Drive); `rclone copy` invece non cancella niente.

**Cifrare i backup automatici.** In chiaro, chi arriva al file o al tuo account cloud legge pagine e segreti di ogni campagna, account e registro con gli indirizzi IP. Per questo l'Admin può scegliere una **password dei backup** (almeno 12 caratteri; meglio una frase di quattro o cinque parole): da allora i backup automatici sono file `.zip.enc` che si aprono solo con quella.

- La password **non è salvata da nessuna parte**: la wiki tiene solo una chiave che chiude i file e non li apre. Né la wiki né un backup in chiaro contengono qualcosa che apra quelli cifrati.
- **Se la perdi, i backup cifrati non li apre più nessuno.** Tienila in un gestore di password o su un foglio al sicuro. In Amministrazione › Backup puoi verificare di ricordarla.
- Cambiando password, i backup già fatti restano con la vecchia. Togliendo la cifratura, i prossimi sono in chiaro.
- Il backup scaricato con «Scarica il backup» resta sempre in chiaro.

Tecnicamente: dalla password nasce con scrypt una coppia di chiavi X25519, di cui la wiki tiene la metà pubblica; ogni backup ha una sua chiave usa e getta ed è cifrato con AES-256-GCM, che si accorge se il file è stato cambiato o è incompleto. Il formato è descritto in `tools/backup-crypto.mjs`.

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

In PowerShell scrivi `"${PWD}:/backup"` al posto di `"$PWD:/backup"`.

Un backup cifrato (`.zip.enc`) si ripristina con gli stessi comandi: lo strumento chiede la password senza mostrarla, o la prende da `CS_BACKUP_PASSWORD`. Con la password sbagliata o il file danneggiato non tocca niente. Per aprirlo senza ripristinarlo:

```bash
node tools/decrypt-backup.mjs crooked-shelf-backup-2026-11-05-030000.zip.enc
```

Il database di prima non si cancella: diventa `crooked-shelf.db.prima-del-ripristino-…`.

Altri modi di portare via i dati (Amministrazione):

- **Esporta in Markdown**: tutte le pagine come file di testo, apribili con Obsidian o qualsiasi editor.
- **Pacchetto mondo** (`.shelf`): mappe, pagine, regole della casa, template, calendario e cronologia del mondo, da importare in una campagna che c'è già o in una nuova, che prende anche la home del pacchetto.

## Sicurezza: cosa sapere

- **L'Admin possiede i dati.** Nelle campagne che non tiene non vede i segreti, ma può scaricare il backup, creare altri Admin e nominare Master: è una cortesia tra persone che si fidano, non una barriera. Dai il ruolo Admin solo a chi affideresti il server.
- **Chi accede** lo decidono gli inviti: senza invito non ci si registra. I visitatori senza account si accendono in Amministrazione › Impostazioni.
- **Limiti**: 20 accessi falliti ogni 10 minuti per indirizzo (e 5 per nome utente), un tetto agli hash delle password in corso, 60 caricamenti di immagini ogni 10 minuti, una quota di spazio per i giocatori. Le immagini si scaricano solo da chi può vedere la pagina (o la risorsa) che le usa; quelle che nessuno usa da un giorno si eliminano da sole.
- **Sessioni**: scadono dopo 30 giorni senza visite e comunque dopo 90 dall'accesso; dal Profilo si chiudono quelle sugli altri dispositivi. Un token di Claude fermo da 90 giorni smette di valere.
- **Password dimenticata**: l'Admin crea un link di reimpostazione da Amministrazione › Utenti, che vale due giorni e una volta sola.
- **Registro**: Amministrazione › Registro elenca accessi, cambi di ruolo e password, inviti, token di Claude e backup degli ultimi sei mesi.
