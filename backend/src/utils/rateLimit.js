const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_PER_IP = Number(process.env.RATE_LIMIT_MAX_PER_IP) || 5;
const DAILY_EVALUATION_LIMIT = Number(process.env.DAILY_EVALUATION_LIMIT) || 100;

const hitsByIp = new Map();
let dailyCount = 0;
let dailyResetAt = nextMidnightUtc();

function nextMidnightUtc() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function resetDailyCounterIfNeeded() {
  if (Date.now() >= dailyResetAt) {
    dailyCount = 0;
    dailyResetAt = nextMidnightUtc();
  }
}

// Limite per IP: finestra fissa di 10 minuti, così una singola sorgente non
// può martellare /evaluate in loop.
function checkIpLimit(ip) {
  const now = Date.now();
  const entry = hitsByIp.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hitsByIp.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_PER_IP) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Budget cap giornaliero globale: protegge dal caso di più IP diversi che
// insieme fanno esplodere la spesa sul modello (es. dietro un proxy/botnet).
function checkDailyBudget() {
  resetDailyCounterIfNeeded();

  if (dailyCount >= DAILY_EVALUATION_LIMIT) {
    return false;
  }

  dailyCount += 1;
  return true;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// Ritorna null se la richiesta può procedere, altrimenti il messaggio di errore.
export function checkRateLimit(req) {
  const ip = getClientIp(req);

  if (!checkIpLimit(ip)) {
    return `Troppe richieste da questo indirizzo, riprova tra qualche minuto (max ${RATE_LIMIT_MAX_PER_IP} ogni 10 minuti).`;
  }

  if (!checkDailyBudget()) {
    return 'Limite giornaliero di valutazioni raggiunto. Riprova domani.';
  }

  return null;
}

// Periodicamente pulisce le voci scadute per non far crescere la Map all'infinito.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hitsByIp) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      hitsByIp.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS).unref();
