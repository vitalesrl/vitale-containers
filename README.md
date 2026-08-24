# Vitale Containers — Media v4

E-commerce locale e gestionale multicanale per Vitale S.r.l.

## Porte
- Frontend Next.js: http://localhost:4000
- Backend Fastify: http://localhost:4001
- Gestionale: http://localhost:4000/admin

## Avvio Windows
1. Installa Node.js 22+.
2. Apri PowerShell nella cartella del progetto.
3. Esegui `npm install`.
4. Esegui `npm run dev` oppure `start-local.bat`.

## Novità v4 — fotografie reali
### Prodotti — `/admin/prodotti`
- upload multiplo JPG, PNG, WEBP e AVIF
- massimo 12 MB per file e 20 foto per prodotto
- scelta della foto principale
- riordino galleria con frecce
- eliminazione singola foto
- anteprima nel gestionale
- foto principale automatica nelle card della vetrina
- galleria fotografica interattiva nella scheda pubblica prodotto

### Container fisici — `/admin/container`
Ogni singola unità può avere una galleria fotografica indipendente, utile per mostrare condizioni, porte, interno, pavimento, targhetta CSC e dettagli del container.

## Storage locale
Senza Supabase le immagini vengono salvate in:

`backend/uploads/`

Il backend le espone da `http://localhost:4001/uploads/...`.

Questa modalità serve per sviluppo locale. Su Render il filesystem è effimero, quindi in produzione va utilizzato Supabase Storage.

## Supabase Storage
Quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono configurati, gli upload passano automaticamente a Supabase Storage nel bucket:

`container-images`

Esegui l'ultima versione di `database/schema.sql`: crea anche la tabella `media_assets`, gli indici, le policy RLS e il bucket pubblico per le foto commerciali.

Variabili backend:

```env
PORT=4001
FRONTEND_ORIGIN=http://localhost:4000
PUBLIC_API_URL=http://localhost:4001
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=container-images
```

Non esporre mai `SUPABASE_SERVICE_ROLE_KEY` nel frontend.

## Persistenza CRUD locale
Senza Supabase il backend salva prodotti, container, richieste e riferimenti alle immagini in:

`backend/data/local-db.json`

Il file viene creato automaticamente al primo avvio.

## Versione
`MEDIA v4` — frontend 4000 / backend 4001.

## Patch V4.1 - eliminazione foto / CORS

- Abilitati esplicitamente i metodi CORS `GET`, `POST`, `PUT`, `PATCH`, `DELETE` e `OPTIONS`.
- Accettati in locale sia `http://localhost:4000` sia `http://127.0.0.1:4000`.
- Messaggio più chiaro nel frontend quando il backend sulla porta 4001 non è raggiungibile.

Dopo l'aggiornamento riavvia sia frontend sia backend.


## V4.2 – Fix DELETE 400
Il client admin non invia più `Content-Type: application/json` nelle richieste DELETE prive di body. Questo evita il `400 Bad Request` generato automaticamente da Fastify per body JSON vuoti. Corretto inoltre il parsing degli errori Fastify (`message`).

## V4.3 — modalità locale 32-bit / Low Memory
Questa patch risolve il problema di sviluppo su PC Windows con Node `ia32`:

`RangeError: Array buffer allocation failed`

`webpack.cache.PackFileCacheStrategy - Caching failed for pack`

La configurazione di produzione/Vercel resta normale. Le ottimizzazioni seguenti si attivano **solo** con `npm run dev:32`:

- cache Webpack PackFile disabilitata in development;
- parallelismo Webpack ridotto a 2;
- heap Node impostato a 768 MB, compatibile con il processo 32-bit;
- eventuali vecchi `--max-old-space-size=4096/6144` vengono rimossi automaticamente;
- `.next/cache` viene pulita a ogni avvio low-memory;
- telemetria Next disabilitata per il processo locale low-memory.

### Avvio consigliato su Windows
`start-local.bat` rileva automaticamente l'architettura Node:

- `ia32` → esegue `npm run dev:32`;
- `x64` → esegue `npm run dev`.

È disponibile anche `start-local-32.bat` per forzare manualmente la modalità low-memory.

Comandi utili:

```powershell
npm run dev:32
npm run clean:frontend
```

Il limite 32-bit riguarda soltanto lo sviluppo locale. Build e deploy Vercel non usano questa modalità.


## V4.4 – Prodotti di default e fix riferimenti media

- `/admin` apre direttamente `/admin/prodotti`.
- Rimossa la sezione frontend `Container` inutilizzata dal menu gestionale.
- Il pannello admin usa il logo ufficiale Vitale S.r.l. della home.
- Le immagini caricate nella galleria non vengono più risalvate come URL legacy del prodotto.
- Gli URL di media gestiti rimasti nel vecchio campo `imageUrl` vengono ignorati se non esiste più il media asset, evitando immagini rotte in home e dettaglio.
- Eliminando una foto, il backend ripulisce anche un eventuale riferimento legacy coincidente.


## V4.5 — Production / Supabase Auth

La V4.5 protegge tutta l'area gestionale con Supabase Auth.

- `/admin/login` usa email/password Supabase.
- tutte le chiamate `/api/admin/*` inviano il Bearer token della sessione;
- il backend valida il token con Supabase prima di eseguire le API amministrative;
- la `SUPABASE_SERVICE_ROLE_KEY` resta esclusivamente nel backend Render;
- il frontend Vercel usa soltanto `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- le API pubbliche della vetrina restano accessibili senza login.

### Variabili Render

```env
PORT=4001
FRONTEND_ORIGIN=https://TUO-DOMINIO-VERCEL
PUBLIC_API_URL=https://TUO-BACKEND.onrender.com
SUPABASE_URL=https://TUO-PROGETTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=container-images
```

### Variabili Vercel

```env
NEXT_PUBLIC_API_URL=https://TUO-BACKEND.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://TUO-PROGETTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Primo accesso

Crea l'utente gestionale in Supabase Dashboard → Authentication → Users. Non serve una nuova esecuzione di `schema.sql` per attivare il login V4.5.
