# LookBook Smart Pricing - Backend

Backend Node con endpoint `POST /evaluate` per stimare il prezzo di un capo usato a partire da una foto. Nessuna dipendenza esterna: richiede solo Node.js 20.6 o superiore.

## Avvio

```bash
cd backend
copy .env.example .env
npm run dev
```

Inserire la propria `PRICING_API_KEY` nel file `.env`. Il file `.env` è escluso da Git.

## Configurare Supabase (storico valutazioni)

Ogni valutazione viene salvata in background dopo aver già risposto
all'utente: la foto va su Supabase Storage (bucket **privato**, url firmati a
scadenza) e i dati della riga vanno in una tabella. Se il salvataggio fallisce
(upload o insert), ci sono fino a 3 tentativi automatici; se falliscono tutti
viene comunque scritta una riga con `status = 'failed'` ed `error_message`
valorizzato, così la valutazione non sparisce senza lasciare traccia.

1. Nel progetto Supabase, apri lo SQL Editor ed esegui:

   ```sql
   create table if not exists evaluations (
     id uuid primary key default gen_random_uuid(),
     category text not null,
     brand text not null,
     condition text not null,
     photo_path text,
     response jsonb,
     status text not null default 'completed' check (status in ('completed', 'failed')),
     error_message text,
     created_at timestamptz not null default now()
   );
   ```

   Se la tabella esiste già dalla versione precedente (colonna `photo_url`
   invece di `photo_path`, senza `status`/`error_message`), migra con:

   ```sql
   alter table evaluations rename column photo_url to photo_path;
   alter table evaluations alter column photo_path drop not null;
   alter table evaluations alter column response drop not null;
   alter table evaluations add column status text not null default 'completed';
   alter table evaluations add column error_message text;
   alter table evaluations add constraint evaluations_status_check check (status in ('completed', 'failed'));
   ```

2. In Storage, crea un bucket (default atteso: `photos`) e lascialo
   **privato** (non spuntare "Public bucket"). Le foto non sono più
   raggiungibili con un url fisso: il backend genera un url firmato con
   scadenza di un'ora ogni volta che restituisce lo storico.

3. Compila in `.env`:
   - `SUPABASE_URL`: url del progetto (es. `https://xxxx.supabase.co`)
   - `SUPABASE_SERVICE_KEY`: la **service role key** (Project Settings → API).
     Va tenuta solo lato server, non va mai esposta al client.
   - `SUPABASE_BUCKET`: nome del bucket creato al punto 2 (default `photos`
     se non impostato)

## Protezione da abuso

`/evaluate` chiama un modello a pagamento ad ogni richiesta, quindi è protetto
da due limiti in memoria (si resettano a un riavvio del server — va bene per
un progetto di questa scala, non per un cluster multi-istanza):

- **Rate limit per IP**: `RATE_LIMIT_MAX_PER_IP` richieste ogni 10 minuti
  (default 5). Oltre la soglia, risposta `429`.
- **Budget giornaliero globale**: `DAILY_EVALUATION_LIMIT` valutazioni al
  giorno in totale, su tutti gli utenti (default 100, si resetta a
  mezzanotte UTC). Protegge dalla spesa anche se il rate limit per IP viene
  aggirato con più indirizzi diversi.

Il server inoltre **non parte** se mancano `PRICING_API_KEY`, `SUPABASE_URL`
o `SUPABASE_SERVICE_KEY`: meglio un errore chiaro all'avvio che un crash alla
prima richiesta.

## Contratto della richiesta

```json
{
  "category": "Abiti",
  "brand": "Zara",
  "condition": "buono",
  "photo": {
    "media_type": "image/jpeg",
    "data": "<base64-della-foto>"
  }
}
```

- `category` deve essere una di: Maglieria, Camicie, T-shirt, Pantaloni,
  Jeans, Gonne, Abiti, Giacche e cappotti, Felpe, Scarpe, Borse, Accessori.
- `brand` max 60 caratteri.
- `photo.media_type` accetta `image/jpeg`, `image/png` o `image/webp`;
  `photo.data` può essere base64 puro oppure una data URL base64. Il
  contenuto decodificato viene verificato byte per byte (magic number) contro
  il `media_type` dichiarato, e scartato se non corrisponde o supera 8MB.

## Test con curl

PowerShell:

```powershell
$photo = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\foto.jpg")); $body = @{ category = "Abiti"; brand = "Zara"; condition = "buono"; photo = @{ media_type = "image/jpeg"; data = $photo } } | ConvertTo-Json -Depth 4; Invoke-RestMethod -Uri "http://localhost:3000/evaluate" -Method Post -ContentType "application/json" -Body $body
```

Git Bash/macOS/Linux:

```bash
PHOTO_BASE64=$(base64 -w 0 ./foto.jpg)
curl -X POST http://localhost:3000/evaluate \
  -H "Content-Type: application/json" \
  -d "{\"category\":\"Abiti\",\"brand\":\"Zara\",\"condition\":\"buono\",\"photo\":{\"media_type\":\"image/jpeg\",\"data\":\"$PHOTO_BASE64\"}}"
```

La risposta completata ha questo formato:

```json
{
  "suggested_price": 45,
  "range": { "min": 30, "max": 60 },
  "motivation": "...",
  "selling_tips": ["...", "..."]
}
```

## Storico: GET /evaluations

Ritorna le ultime valutazioni con `status = 'completed'`, dalla più recente
(quelle fallite non sono esposte qui, restano solo in tabella per diagnosi).
Parametro opzionale `limit` (default 50, massimo 100).

```bash
curl "http://localhost:3000/evaluations?limit=20"
```

```json
[
  {
    "id": "…",
    "category": "Abiti",
    "brand": "Zara",
    "condition": "buono",
    "status": "completed",
    "photo_url": "https://xxxx.supabase.co/storage/v1/object/sign/photos/….jpg?token=...",
    "response": { "suggested_price": 45, "range": { "min": 30, "max": 60 }, "motivation": "...", "selling_tips": ["...", "..."] },
    "created_at": "2026-09-12T18:30:00.000Z"
  }
]
```

`photo_url` è generato al volo ad ogni richiesta (url firmato, scade dopo
un'ora) — non salvarlo/riusarlo lato client oltre quella finestra.
