import { useRef, useState } from "react";
import { Camera, ImageIcon, X } from "lucide-react";
import { photoKb, readPhoto, type Photo } from "../data/photo";

/**
 * Take or pick one photo. On phones `capture` opens the back camera; on a
 * desktop it opens the file picker. Shows a thumbnail with retake / remove.
 */
export function PhotoField({
  label,
  name,
  value,
  saved,
  onChange,
}: {
  label: string;
  /** File name stem, e.g. the outturn. */
  name: string;
  value?: Photo;
  /** A photo is already stored for this record (not loaded, to save data). */
  saved?: boolean;
  onChange: (p: Photo | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await readPhoto(file, name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the photo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="photo-field">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="photo-thumb">
          <img src={value.preview} alt={label} />
          <div className="photo-meta">
            <span className="hint">Photo ready · {photoKb(value)} KB · sent when you save</span>
            <div className="btn-pair">
              <button type="button" className="btn btn-soft btn-sm" onClick={() => input.current?.click()}>
                <Camera size={16} aria-hidden /> Retake
              </button>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => onChange(undefined)} aria-label="Remove photo">
                <X size={16} aria-hidden /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-soft" disabled={busy} onClick={() => input.current?.click()}>
          {saved ? <ImageIcon size={18} aria-hidden /> : <Camera size={18} aria-hidden />}
          {busy ? "Reading photo…" : saved ? "Photo saved · take a new one" : label}
        </button>
      )}
      {error && <p className="hint hint-crit">{error}</p>}
    </div>
  );
}
