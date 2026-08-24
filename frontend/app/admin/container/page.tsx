"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaManager } from "@/components/MediaManager";
import { adminApi, type ContainerPayload } from "@/lib/adminApi";
import type { ContainerStatus, ContainerUnit, MediaAsset, Product } from "@/lib/types";

const emptyContainer: ContainerPayload = {
  productId: null, containerNumber: "", status: "available", year: null, manufacturer: "", color: "", tareKg: null,
  cscExpiry: null, purchasePrice: null, salePrice: null, notes: ""
};

const statusLabels: Record<ContainerStatus, string> = { available: "Disponibile", reserved: "Riservato", sold: "Venduto", incoming: "In arrivo", unavailable: "Non disponibile" };
function num(value: string) { if (!value) return null; const n = Number(value.replace(",", ".")); return Number.isFinite(n) ? n : null; }

export default function AdminContainersPage() {
  const [items, setItems] = useState<ContainerUnit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ContainerPayload>(emptyContainer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingImages, setEditingImages] = useState<MediaAsset[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try { const [units, productList] = await Promise.all([adminApi.containers.list(), adminApi.products.list()]); setItems(units); setProducts(productList); }
    catch (e) { setError(e instanceof Error ? e.message : "Backend non raggiungibile"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? items.filter((i) => `${i.containerNumber} ${i.productTitle ?? ""} ${i.manufacturer} ${i.color} ${i.status}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  function createNew() { setEditingId(null); setEditingImages([]); setForm({ ...emptyContainer }); setEditorOpen(true); setError(""); setNotice(""); }
  function edit(item: ContainerUnit) { setEditingId(item.id); setEditingImages(item.images ?? []); setForm({ productId: item.productId, containerNumber: item.containerNumber, status: item.status, year: item.year, manufacturer: item.manufacturer, color: item.color, tareKg: item.tareKg, cscExpiry: item.cscExpiry, purchasePrice: item.purchasePrice, salePrice: item.salePrice, notes: item.notes }); setEditorOpen(true); setError(""); setNotice(""); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const saved = editingId ? await adminApi.containers.update(editingId, form) : await adminApi.containers.create(form);
      setEditingId(saved.id); setEditingImages(saved.images ?? editingImages);
      setForm({ productId: saved.productId, containerNumber: saved.containerNumber, status: saved.status, year: saved.year, manufacturer: saved.manufacturer, color: saved.color, tareKg: saved.tareKg, cscExpiry: saved.cscExpiry, purchasePrice: saved.purchasePrice, salePrice: saved.salePrice, notes: saved.notes });
      setNotice(editingId ? "Container aggiornato." : "Container creato. Ora puoi aggiungere le fotografie dell'unità.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Salvataggio non riuscito"); }
    finally { setSaving(false); }
  }
  async function remove(item: ContainerUnit) { if (!confirm(`Eliminare il container ${item.containerNumber}?`)) return; try { await adminApi.containers.remove(item.id); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Eliminazione non riuscita"); } }

  return <>
    <header className="admin-head"><div><div className="eyebrow">MAGAZZINO FISICO</div><h1>Container</h1><p className="admin-subtitle">Gestisci le singole unità, il numero container, lo stato commerciale, i costi e le fotografie specifiche.</p></div><button className="button button-dark" onClick={createNew}>+ Nuovo container</button></header>
    {error && <div className="admin-alert error">{error}</div>}
    {notice && <div className="admin-alert success">{notice}</div>}
    {editorOpen && <section className="admin-panel admin-editor"><div className="editor-head"><div><div className="eyebrow">{editingId ? "MODIFICA UNITÀ" : "NUOVA UNITÀ"}</div><h2>{editingId ? form.containerNumber : "Inserisci container"}</h2></div><button className="icon-button" onClick={() => setEditorOpen(false)}>×</button></div>
      <form onSubmit={save}><div className="form-grid">
        <label>Numero container<input required value={form.containerNumber} onChange={(e) => setForm({ ...form, containerNumber: e.target.value.toUpperCase() })} placeholder="MSCU1234567" /></label>
        <label>Prodotto<select value={form.productId ?? ""} onChange={(e) => setForm({ ...form, productId: e.target.value || null })}><option value="">Non associato</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label>Stato<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContainerStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Anno<input type="number" min="1950" max="2100" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: num(e.target.value) })} /></label>
        <label>Costruttore<input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></label>
        <label>Colore<input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
        <label>Tara kg<input type="number" step="0.01" min="0" value={form.tareKg ?? ""} onChange={(e) => setForm({ ...form, tareKg: num(e.target.value) })} /></label>
        <label>Scadenza CSC<input type="date" value={form.cscExpiry ?? ""} onChange={(e) => setForm({ ...form, cscExpiry: e.target.value || null })} /></label>
        <label>Prezzo acquisto €<input type="number" step="0.01" min="0" value={form.purchasePrice ?? ""} onChange={(e) => setForm({ ...form, purchasePrice: num(e.target.value) })} /></label>
        <label>Prezzo vendita €<input type="number" step="0.01" min="0" value={form.salePrice ?? ""} onChange={(e) => setForm({ ...form, salePrice: num(e.target.value) })} /></label>
        <label className="span-4">Note<textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div><div className="form-actions"><button type="button" className="button button-outline" onClick={() => setEditorOpen(false)}>Chiudi</button><button disabled={saving} className="button button-dark">{saving ? "Salvataggio…" : editingId ? "Salva modifiche" : "Crea container"}</button></div></form>
      {editingId ? <MediaManager entityType="container" entityId={editingId} initialImages={editingImages} onChanged={(images) => { setEditingImages(images); void load(); }} /> : <div className="media-save-first">Salva prima il container; subito dopo potrai caricare le fotografie dell'unità.</div>}
    </section>}
    <section className="admin-panel table-wrap"><div className="table-toolbar"><input className="admin-search" placeholder="Cerca numero, prodotto, colore…" value={query} onChange={(e) => setQuery(e.target.value)} /><span>{filtered.length} unità</span></div>
      <table><thead><tr><th>Container</th><th>Foto</th><th>Prodotto</th><th>Stato</th><th>Anno</th><th>Acquisto</th><th>Vendita</th><th>Azioni</th></tr></thead><tbody>{loading ? <tr><td colSpan={8}>Caricamento…</td></tr> : filtered.length === 0 ? <tr><td colSpan={8}>Nessun container inserito.</td></tr> : filtered.map((i) => <tr key={i.id}>
        <td><strong>{i.containerNumber}</strong><small>{[i.manufacturer, i.color].filter(Boolean).join(" · ") || "—"}</small></td>
        <td>{i.images?.[0]?.url ? <img className="admin-table-thumb" src={(i.images.find((x) => x.isPrimary) ?? i.images[0]).url} alt="" /> : <span className="no-photo">—</span>}<small>{i.images?.length ? `${i.images.length} foto` : "Nessuna foto"}</small></td>
        <td>{i.productTitle ?? "Non associato"}</td><td><span className={`unit-status ${i.status}`}>{statusLabels[i.status]}</span></td><td>{i.year ?? "—"}</td><td>{i.purchasePrice !== null ? `€ ${i.purchasePrice.toLocaleString("it-IT")}` : "—"}</td><td>{i.salePrice !== null ? `€ ${i.salePrice.toLocaleString("it-IT")}` : "—"}</td><td><div className="row-actions"><button onClick={() => edit(i)}>Modifica</button><button className="danger" onClick={() => void remove(i)}>Elimina</button></div></td></tr>)}</tbody></table>
    </section>
  </>;
}
