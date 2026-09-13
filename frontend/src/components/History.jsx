import { useCallback, useEffect, useState } from 'react';
import { getEvaluations } from '../services/api';

function HistoryItem({ item }) {
  const price = item.response?.suggested_price;
  const date = new Date(item.created_at).toLocaleString('it-IT');

  return (
    <li className="history-item">
      <img src={item.photo_url} alt={`${item.brand} ${item.category}`} />
      <div className="history-item__info">
        <p className="history-item__title">
          {item.brand} · {item.category}
        </p>
        <p className="history-item__meta">
          {item.condition} · {date}
        </p>
      </div>
      {typeof price === 'number' && <p className="history-item__price">€ {price}</p>}
    </li>
  );
}

export default function History({ refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    return getEvaluations(10)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="history">
      <div className="history__header">
        <h2>Ultime valutazioni</h2>
        <button type="button" onClick={load} disabled={loading}>
          Aggiorna
        </button>
      </div>

      {loading && <p>Caricamento storico…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && <p>Nessuna valutazione salvata ancora.</p>}

      {items.length > 0 && (
        <ul className="history__list">
          {items.map((item) => (
            <HistoryItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
