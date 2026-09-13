import app from './app.js';

try {
  process.loadEnvFile();
} catch {
  // .env facoltativo: si possono impostare le variabili direttamente nell'ambiente
}

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`LookBook backend in ascolto su http://localhost:${port}`);
});
