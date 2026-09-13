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

Ogni valutazione completata viene salvata in background: la foto va su Supabase
Storage e i dati della riga (categoria, brand, stato, url foto, risposta del
modello, data) vanno in una tabella. Se il salvataggio fallisce, l'errore viene
solo loggato: la risposta all'utente non viene bloccata.

1. Nel progetto Supabase, apri lo SQL Editor ed esegui:

   ```sql
   create table if not exists evaluations (
     id uuid primary key default gen_random_uuid(),
     category text not null,
     brand text not null,
     condition text not null,
     photo_url text not null,
     response jsonb not null,
     created_at timestamptz not null default now()
   );
   ```

2. In Storage, crea un bucket (default atteso: `photos`) e impostalo come
   **pubblico**, così l'url salvato in tabella è direttamente utilizzabile
   senza dover generare link firmati.

3. Compila in `.env`:
   - `SUPABASE_URL`: url del progetto (es. `https://xxxx.supabase.co`)
   - `SUPABASE_SERVICE_KEY`: la **service role key** (Project Settings → API).
     Va tenuta solo lato server, non va mai esposta al client.
   - `SUPABASE_BUCKET`: nome del bucket creato al punto 2 (default `photos`
     se non impostato)

## Contratto della richiesta

```json
{
  "category": "abito",
  "brand": "Zara",
  "condition": "buono",
  "photo": {
    "media_type": "image/jpeg",
    "data": "<base64-della-foto>"
  }
}
```

Sono accettati `image/jpeg`, `image/png` e `image/webp`. `photo.data` può essere base64 puro oppure una data URL base64.

## Test con curl

PowerShell:

```powershell
$photo = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\foto.jpg")); $body = @{ category = "abito"; brand = "Zara"; condition = "buono"; photo = @{ media_type = "image/jpeg"; data = $photo } } | ConvertTo-Json -Depth 4; Invoke-RestMethod -Uri "http://localhost:3000/evaluate" -Method Post -ContentType "application/json" -Body $body
```

Git Bash/macOS/Linux:

```bash
PHOTO_BASE64=$(base64 -w 0 ./foto.jpg)
curl -X POST http://localhost:3000/evaluate \
  -H "Content-Type: application/json" \
  -d "{\"category\":\"abito\",\"brand\":\"Zara\",\"condition\":\"buono\",\"photo\":{\"media_type\":\"image/jpeg\",\"data\":\"$PHOTO_BASE64\"}}"
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

Ritorna le ultime valutazioni salvate, dalla più recente. Parametro opzionale
`limit` (default 50, massimo 100).

```bash
curl "http://localhost:3000/evaluations?limit=20"
```

```json
[
  {
    "id": "…",
    "category": "abito",
    "brand": "Zara",
    "condition": "buono",
    "photo_url": "https://xxxx.supabase.co/storage/v1/object/public/photos/….jpg",
    "response": { "suggested_price": 45, "range": { "min": 30, "max": 60 }, "motivation": "...", "selling_tips": ["...", "..."] },
    "created_at": "2026-09-12T18:30:00.000Z"
  }
]
```
