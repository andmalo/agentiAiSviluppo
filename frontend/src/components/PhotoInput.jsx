export default function PhotoInput({ previewUrl, onSelect, disabled }) {
  return (
    <label className="field photo-input">
      <span className="field__label">Foto del capo</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
        disabled={disabled}
      />
      {previewUrl && (
        <img className="photo-input__preview" src={previewUrl} alt="Anteprima del capo caricato" />
      )}
    </label>
  );
}
