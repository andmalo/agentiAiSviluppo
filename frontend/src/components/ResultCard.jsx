export default function ResultCard({ result }) {
  if (!result) {
    return null;
  }

  return (
    <section className="result-card" aria-live="polite">
      <p className="result-card__price">€ {result.suggested_price}</p>
      <p className="result-card__range">
        Range: € {result.range.min} – € {result.range.max}
      </p>
      <p className="result-card__motivation">{result.motivation}</p>
      <ul className="result-card__tips">
        {result.selling_tips.map((tip, index) => (
          <li key={index}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
