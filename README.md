# LookBook Smart Pricing

Stima il prezzo di vendita di un capo d'abbigliamento usato a partire da una
foto. Il frontend (React + Vite) raccoglie foto, categoria, brand e stato; il
backend (Node, senza dipendenze npm) chiama un modello con capacità vision,
salva la valutazione su Supabase (foto su Storage, dati su Postgres) e la
restituisce.

```
.
├── backend/    Node + http nativo — POST /evaluate, GET /evaluations
└── frontend/   React + Vite — form, anteprima foto, storico
```

## 1. Locale

### 1.1 Backend

```bash
cd backend
copy .env.example .env
npm run dev
```

Compila `backend/.env`:

| Variabile | Obbligatoria | Descrizione |
|---|---|---|
| `PORT` | no (default 3000) | porta locale |
| `PRICING_API_KEY` | sì | chiave OpenAI |
| `PRICING_MODEL` | no (default `gpt-4o`) | modello con vision |
| `SUPABASE_URL` | sì | url del progetto Supabase |
| `SUPABASE_SERVICE_KEY` | sì | service role key, solo lato server |
| `SUPABASE_BUCKET` | no (default `photos`) | bucket Storage per le foto |
| `FRONTEND_URL` | no (default `*`) | origine ammessa in CORS, es. `http://localhost:5173` |

Setup Supabase (tabella + bucket): vedi [backend/README.md](backend/README.md).

Il backend non ha dipendenze npm da installare: nessun `node_modules`, parte
subito con `npm run dev`.

### 1.2 Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Compila `frontend/.env`:

| Variabile | Obbligatoria | Descrizione |
|---|---|---|
| `VITE_API_URL` | sì | url del backend, es. `http://localhost:3000` |

Apri `http://localhost:5173`.

## 2. Deploy

Serve che il progetto sia su un repository Git (GitHub/GitLab/Bitbucket):
Render e Netlify fanno il deploy leggendo da lì, non da file caricati a mano.

Ordine consigliato, per evitare il problema dell'uovo e della gallina (ognuno
dei due url serve per configurare l'altro):

1. **Deploy del backend su Render** → ottieni l'url del backend
   (es. `https://lookbook-backend.onrender.com`).
2. **Deploy del frontend su Netlify**, con `VITE_API_URL` puntato all'url
   ottenuto al passo 1 → ottieni l'url del frontend
   (es. `https://lookbook-smart-pricing.netlify.app`).
3. **Torna su Render** e imposta `FRONTEND_URL` con l'url ottenuto al passo 2,
   così il CORS accetta le richieste dal frontend pubblicato. Salvando,
   Render fa automaticamente un nuovo deploy.

### 2.1 Backend su Render

1. New → Web Service → collega il repository.
2. **Root Directory**: `backend`
3. **Environment**: Node
4. **Build Command**: `npm install` (non ci sono dipendenze, ma il comando
   deve essere presente)
5. **Start Command**: `node src/server.js`
6. Variabili d'ambiente da impostare su Render (Settings → Environment):

   | Variabile | Valore |
   |---|---|
   | `PRICING_API_KEY` | la tua chiave OpenAI |
   | `PRICING_MODEL` | `gpt-4o` (o il modello che preferisci) |
   | `SUPABASE_URL` | url del progetto Supabase |
   | `SUPABASE_SERVICE_KEY` | service role key di Supabase |
   | `SUPABASE_BUCKET` | `photos` |
   | `FRONTEND_URL` | url del sito Netlify (aggiungila dopo il passo 2.2) |

   `PORT` non va impostata: la mette Render automaticamente e il codice la
   legge già da `process.env.PORT`.

### 2.2 Frontend su Netlify

1. Add new site → Import an existing project → collega il repository.
2. **Base directory**: `frontend`
3. **Build command**: `npm run build`
4. **Publish directory**: `frontend/dist`
5. Variabile d'ambiente da impostare su Netlify (Site configuration →
   Environment variables):

   | Variabile | Valore |
   |---|---|
   | `VITE_API_URL` | url del backend su Render (es. `https://lookbook-backend.onrender.com`) |

   Vite inserisce questa variabile nel codice **al momento della build**, non
   a runtime: se la cambi dopo, serve un nuovo deploy (Deploys → Trigger
   deploy) perché abbia effetto.

### 2.3 Verifica finale

Apri il sito Netlify, fai una valutazione di prova. Se il browser dà errore
CORS in console, controlla che `FRONTEND_URL` su Render corrisponda esattamente
all'url Netlify (compreso `https://`, senza slash finale) e che il servizio
Render sia stato ridistribuito dopo averlo impostato.

## 3. Note

- Le chiavi vere non vanno mai committate: restano solo nei `.env` locali
  (esclusi da Git) e nelle variabili d'ambiente di Render/Netlify.
- Il salvataggio su Supabase avviene in background dopo aver risposto
  all'utente: se fallisce, l'errore viene solo loggato lato backend.
- Dettagli su schema tabella, bucket e formato risposta del modello:
  [backend/README.md](backend/README.md).
