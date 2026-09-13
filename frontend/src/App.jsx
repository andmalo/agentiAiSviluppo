import { useState } from 'react';
import PhotoInput from './components/PhotoInput';
import ResultCard from './components/ResultCard';
import History from './components/History';
import { CATEGORIES, CONDITIONS } from './constants';
import { processImage } from './utils/image';
import { evaluate } from './services/api';

const SAVE_DELAY_MS = 1500;

export default function App() {
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [condition, setCondition] = useState('');
  const [photo, setPhoto] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  async function handlePhotoSelect(file) {
    setError(null);
    setPhoto(null);

    if (!file) {
      return;
    }

    try {
      const processed = await processImage(file);
      setPhoto(processed);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!category || !brand.trim() || !condition || !photo) {
      setError('Compila categoria, brand, stato e carica una foto prima di valutare.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await evaluate({
        category,
        brand: brand.trim(),
        condition,
        photo: { media_type: photo.mediaType, data: photo.base64 }
      });

      setResult(data);
      setTimeout(() => setHistoryRefreshKey((key) => key + 1), SAVE_DELAY_MS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <h1>LookBook Smart Pricing</h1>
      <p className="app__subtitle">Carica una foto del capo e ricevi una stima di prezzo per l'usato.</p>

      <form className="form" onSubmit={handleSubmit}>
        <PhotoInput previewUrl={photo?.previewUrl} onSelect={handlePhotoSelect} disabled={loading} />

        <label className="field">
          <span className="field__label">Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading}>
            <option value="">Seleziona una categoria</option>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Brand</span>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Es. Zara"
            disabled={loading}
          />
        </label>

        <label className="field">
          <span className="field__label">Stato</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} disabled={loading}>
            <option value="">Seleziona lo stato</option>
            {CONDITIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="submit" disabled={loading}>
          {loading ? 'Valutazione in corso…' : 'Valuta'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Sto analizzando la foto, un momento…</p>}

      <ResultCard result={result} />

      <History refreshKey={historyRefreshKey} />
    </main>
  );
}
