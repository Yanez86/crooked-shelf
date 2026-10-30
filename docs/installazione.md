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

Apri **http://localhost:3000**. La prima volta si crea la wiki e l'account amministratore.

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

Per rendere la wiki raggiungibile da fuori casa serve un dominio (es. `wiki.esempio.it`) e un "proxy" che gestisca HTTPS. Il più semplice è [Caddy](https://caddyserver.com/), che ottiene il certificato da solo.

`Caddyfile`:

```
wiki.esempio.it {
	reverse_proxy localhost:3000
}
```

E in `docker-compose.yml` togli il `#` da queste righe:

```yaml
CS_ORIGIN: "https://wiki.esempio.it"
CS_TRUST_PROXY: "1"
```

L'accesso dei visitatori senza account è **spento** di default: finché non lo accendi, sulla wiki entra solo chi ha ricevuto un invito.

## 4. Provarla online gratis, con Render

Per dare un'occhiata alla wiki da fuori casa senza un server tuo c'è [Render](https://render.com/): il file `render.yaml` è già pronto.

1. Accedi a Render con GitHub.
2. **New › Blueprint**, scegli il repository e conferma.
3. Finita la costruzione, apri l'indirizzo `https://crooked-shelf-….onrender.com` e crea **subito** la wiki e l'account amministratore: finché non lo fai, chiunque apra l'indirizzo può farlo al posto tuo.

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

Senza `CS_ORIGIN` la wiki usa l'indirizzo con cui viene raggiunta, in `http`: così funziona subito in rete locale.

## Backup e ripristino

**Backup**: Amministrazione › Backup › «Scarica il backup». Il file contiene database, immagini e plugin installati. Conservalo su un altro disco.

**Ripristino senza Docker** (wiki ferma):

```bash
node tools/restore.mjs crooked-shelf-backup-2026-10-29.zip ./data --force
```

**Ripristino con Docker**, dalla cartella dove si trova il file di backup:

```bash
docker compose stop
docker compose run --rm -v "$PWD:/backup" crooked-shelf node tools/restore.mjs /backup/crooked-shelf-backup-2026-10-29.zip /data --force
docker compose start
```

Il database che c'era prima non viene cancellato: viene rinominato `crooked-shelf.db.prima-del-ripristino-…`.

Altri modi di portare via i dati (Amministrazione):

- **Esporta in Markdown**: tutte le pagine come file di testo, apribili con Obsidian o qualsiasi editor.
- **Pacchetto mondo** (`.shelf`): mappe, pagine, regole della casa, template, calendario e cronologia del mondo, da importare in un'altra wiki.
