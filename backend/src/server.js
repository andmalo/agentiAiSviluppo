import app from './app.js';

try {
  process.loadEnvFile();
} catch {
  // .env facoltativo: si possono impostare le variabili direttamente nell'ambiente
}

const REQUIRED_ENV_VARS = ['PRICING_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];

const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Variabili d'ambiente mancanti: ${missing.join(', ')}. Il server non parte.`);
  process.exit(1);
}

if (!process.env.FRONTEND_URL) {
  console.warn('FRONTEND_URL non impostata: il CORS accetta richieste da qualunque origine (*).');
}

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`LookBook backend in ascolto su http://localhost:${port}`);
});
