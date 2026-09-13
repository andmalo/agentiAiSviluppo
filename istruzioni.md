# LookBook Smart Pricing AI

## 1. Descrizione del progetto

LookBook Smart Pricing AI è un'applicazione web per stimare il prezzo di vendita di un capo d'abbigliamento usato.

L'utente:

1. carica una foto del vestito;
2. seleziona la categoria;
3. inserisce o seleziona il brand;
4. indica lo stato del capo: `nuovo`, `buono` oppure `usato`;
5. avvia la valutazione.

Il backend invia immagine e dati descrittivi a Claude con capacità vision. Il modello restituisce una stima strutturata composta da:

- `suggested_price`: prezzo consigliato;
- `price_range`: intervallo con `min` e `max`;
- `motivation`: motivazione della stima;
- `selling_tips`: array di suggerimenti per l'annuncio e la vendita.

Ogni valutazione viene salvata insieme agli input dell'utente, al riferimento della foto, alla risposta del modello e alla data di creazione.

## 2. Stack tecnologico

### Frontend

- React;
- Vite;
- JavaScript o TypeScript, da decidere prima dell'implementazione;
- client Supabase solo se servirà autenticazione o accesso diretto a funzionalità non sensibili.

Il frontend gestisce il form, l'anteprima della foto, gli stati di caricamento/errore e la visualizzazione della stima. La chiave API di Claude non deve mai essere esposta nel browser.

### Backend

- Node.js;
- Express;
- SDK o API ufficiale di Anthropic per Claude;
- client Supabase server-side;
- validazione degli input e della risposta del modello.

Il backend espone un endpoint per creare una valutazione. Riceve i dati del capo e la foto, salva la foto su Supabase Storage, invoca Claude e salva il risultato completo in Supabase.

### Persistenza e file

- Supabase Postgres per i dati delle valutazioni;
- Supabase Storage per le immagini;
- campo `jsonb` per la risposta strutturata di Claude;
- policy RLS di Supabase da definire insieme all'eventuale autenticazione.

### Deploy

- Netlify per il frontend Vite;
- Render per il backend Express;
- variabili d'ambiente separate per sviluppo, staging e produzione;
- configurazione CORS limitata al dominio Netlify in produzione.

## 3. Flusso applicativo proposto

1. Il frontend controlla formato e dimensione della foto e la validità dei campi.
2. Il frontend invia `multipart/form-data` al backend.
3. Il backend valida nuovamente input e file.
4. Il backend carica la foto nel bucket Supabase Storage.
5. Il backend costruisce il prompt per Claude includendo foto, categoria, brand e stato.
6. Claude restituisce esclusivamente il JSON concordato.
7. Il backend valida e normalizza il JSON ricevuto.
8. Il backend salva la valutazione in Postgres.
9. Il backend restituisce al frontend la risposta strutturata e l'identificativo della valutazione.

Se Claude non risponde, restituisce JSON non valido o il salvataggio fallisce, la valutazione deve essere marcata come fallita oppure non salvata come completa, senza mostrare un prezzo inventato all'utente.

## 4. Struttura del repository

Si propone un monorepo con frontend e backend separati:

```text
lookbook-smart-pricing-ai/
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── types/
│       ├── App.*
│       └── main.*
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── validators/
│       ├── app.*
│       └── server.*
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── .env.example
├── .gitignore
├── README.md
└── istruzioni.md
```

Responsabilità principali:

- `frontend/src/components`: componenti riutilizzabili, come upload foto, form e risultato;
- `frontend/src/services`: chiamate HTTP al backend;
- `backend/src/routes`: definizione degli endpoint;
- `backend/src/controllers`: coordinamento della richiesta e della risposta HTTP;
- `backend/src/services`: integrazione con Claude, Supabase Storage e Postgres;
- `backend/src/validators`: controllo di campi, file e risposta di Claude;
- `supabase/migrations`: schema del database versionato.

Endpoint iniziale suggerito:

```text
POST /api/evaluations
```

## 5. Schema Supabase proposto

### Tabella `evaluations`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | `uuid` | chiave primaria, default `gen_random_uuid()` |
| `category` | `text` | categoria del capo, obbligatoria |
| `brand` | `text` | brand inserito dall'utente, obbligatorio |
| `condition` | `text` | valore controllato: `nuovo`, `buono`, `usato` |
| `image_path` | `text` | percorso dell'immagine nel bucket Storage |
| `image_content_type` | `text` | tipo MIME validato, ad esempio `image/jpeg` |
| `image_size_bytes` | `integer` | dimensione del file al momento dell'upload |
| `model_name` | `text` | modello Claude utilizzato |
| `model_response` | `jsonb` | risposta completa e validata del modello |
| `status` | `text` | ad esempio `completed` o `failed` |
| `error_message` | `text` | valorizzato solo per valutazioni fallite |
| `created_at` | `timestamptz` | default `now()` |

La risposta in `model_response` dovrebbe avere questa forma logica:

```json
{
  "suggested_price": 45,
  "price_range": {
    "min": 30,
    "max": 60
  },
  "motivation": "Motivazione della stima.",
  "selling_tips": [
    "Fotografa il capo con luce naturale.",
    "Indica misure e condizioni nella descrizione."
  ]
}
```

È preferibile salvare la risposta completa in `jsonb`, invece di duplicare subito ogni proprietà in colonne separate. In questo modo si conserva il risultato originale e si mantiene flessibilità nel caso in cui il contratto della risposta evolva. Se in futuro serviranno ricerche frequenti per prezzo minimo, massimo o prezzo consigliato, sarà possibile aggiungere colonne numeriche derivate e indicizzate.

### Vincoli e indici

- `condition` deve accettare solo `nuovo`, `buono` e `usato`;
- `status` deve accettare almeno `completed` e `failed`;
- `image_path` deve essere obbligatorio per le valutazioni completate;
- `model_response` deve essere obbligatorio per le valutazioni completate;
- indice su `created_at` per ordinare rapidamente lo storico;
- eventuale indice su `brand` e `category` se verranno aggiunti filtri o statistiche.

### Storage

Creare un bucket, ad esempio `evaluation-images`, dedicato alle immagini delle valutazioni. Il database deve salvare il percorso (`image_path`), non l'immagine binaria.

Le immagini dovrebbero avere:

- limite di dimensione configurato;
- MIME type limitati ai formati necessari, ad esempio JPEG, PNG e WebP;
- nomi generati dal backend, senza usare direttamente il nome originale dell'utente.

Se l'app non avrà autenticazione nella prima versione, il bucket non dovrebbe essere pubblico senza una decisione esplicita. Il backend può usare la service role key per caricare i file e generare URL firmati quando serve. La service role key deve restare esclusivamente nelle variabili d'ambiente del backend.

### Sicurezza e RLS

Se ogni valutazione sarà associata a un utente, aggiungere:

```text
user_id uuid references auth.users(id)
```

e configurare RLS affinché ogni utente possa leggere solo le proprie valutazioni. Se la prima versione è anonima, conviene lasciare comunque il database non accessibile direttamente dal browser e far passare creazione e lettura dal backend, con autorizzazione progettata prima del deploy.

## 6. Variabili d'ambiente da prevedere

Backend:

- `PORT`;
- `ANTHROPIC_API_KEY`;
- `ANTHROPIC_MODEL`;
- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_STORAGE_BUCKET`;
- `FRONTEND_URL`.

Frontend:

- `VITE_API_URL`.

Le variabili reali non devono essere committate. Nel repository va mantenuto solo `.env.example` con nomi e descrizioni, senza segreti.

## 7. Decisioni da confermare prima di scrivere codice

1. Usare JavaScript o TypeScript sia nel frontend sia nel backend.
2. Prevedere autenticazione Supabase nella prima versione oppure lavorare inizialmente con valutazioni anonime.
3. Stabilire il modello Claude specifico e il budget massimo per richiesta.
4. Definire dimensione massima e formati accettati per le immagini.
5. Decidere se mantenere anche le valutazioni fallite oppure registrare solo quelle completate.
6. Definire se il prezzo sarà espresso sempre in euro e se sarà un numero intero o potrà contenere centesimi.
