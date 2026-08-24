"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi, type MediaEntityType } from "@/lib/adminApi";
import type { MediaAsset } from "@/lib/types";

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaManager({
  entityType,
  entityId,
  initialImages = [],
  onChanged
}: {
  entityType: MediaEntityType;
  entityId: string;
  initialImages?: MediaAsset[];
  onChanged?: (images: MediaAsset[]) => void;
}) {
  const [images, setImages] = useState<MediaAsset[]>(initialImages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setImages(initialImages); setError(""); }, [entityId, initialImages]);

  async function refresh() {
    const next = await adminApi.media.list(entityType, entityId);
    setImages(next);
    onChanged?.(next);
    return next;
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError("");
    try {
      await adminApi.media.upload(entityType, entityId, Array.from(files));
      await refresh();
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) { setError(e instanceof Error ? e.message : "Upload non riuscito"); }
    finally { setBusy(false); }
  }

  async function makePrimary(id: string) {
    setBusy(true); setError("");
    try { await adminApi.media.setPrimary(id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Aggiornamento non riuscito"); }
    finally { setBusy(false); }
  }

  async function remove(image: MediaAsset) {
    if (!window.confirm(`Eliminare la foto “${image.originalName}”?`)) return;
    setBusy(true); setError("");
    try { await adminApi.media.remove(image.id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Eliminazione non riuscita"); }
    finally { setBusy(false); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = images.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    setBusy(true); setError("");
    try {
      const saved = await adminApi.media.reorder(entityType, entityId, next.map((image) => image.id));
      setImages(saved); onChanged?.(saved);
    } catch (e) {
      setImages(images);
      setError(e instanceof Error ? e.message : "Riordino non riuscito");
    } finally { setBusy(false); }
  }

  return (
    <section className="media-manager">
      <div className="media-head">
        <div><div className="eyebrow">FOTOGRAFIE</div><h3>Galleria immagini</h3><p>JPG, PNG, WEBP o AVIF · massimo 12 MB per foto · fino a 20 immagini.</p></div>
        <label className={`button button-outline upload-button ${busy ? "disabled" : ""}`}>
          {busy ? "Caricamento…" : "+ Carica foto"}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={busy} onChange={(e) => void upload(e.target.files)} />
        </label>
      </div>
      {error && <div className="admin-alert error media-error">{error}</div>}
      {images.length === 0 ? <div className="media-empty">Nessuna fotografia caricata.</div> : (
        <div className="media-grid">
          {images.map((image, index) => (
            <article className={`media-card ${image.isPrimary ? "primary" : ""}`} key={image.id}>
              <div className="media-preview"><img src={image.url} alt={image.originalName} />{image.isPrimary && <span>PRINCIPALE</span>}</div>
              <div className="media-meta"><strong title={image.originalName}>{image.originalName}</strong><small>{fileSize(image.sizeBytes)} · {image.storageProvider === "supabase" ? "Supabase" : "Locale"}</small></div>
              <div className="media-actions">
                <button type="button" disabled={busy || index === 0} onClick={() => void move(index, -1)} title="Sposta a sinistra">←</button>
                <button type="button" disabled={busy || index === images.length - 1} onClick={() => void move(index, 1)} title="Sposta a destra">→</button>
                {!image.isPrimary && <button type="button" disabled={busy} onClick={() => void makePrimary(image.id)}>Principale</button>}
                <button type="button" className="danger" disabled={busy} onClick={() => void remove(image)}>Elimina</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
