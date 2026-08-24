"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaManager } from "@/components/MediaManager";
import { adminApi, type ProductPayload } from "@/lib/adminApi";
import type { MediaAsset, Product } from "@/lib/types";

const CONTAINER_TYPES = ["Box Standard", "Reefer", "Uso ufficio"] as const;
const CONTAINER_SIZES = ["20'", "40'", "40HC"] as const;

type ContainerType = (typeof CONTAINER_TYPES)[number];
type ContainerSize = (typeof CONTAINER_SIZES)[number];
type TechnicalPreset = Pick<ProductPayload, "lengthM" | "widthM" | "heightM" | "volumeM3">;

const CONTAINER_PRESETS: Record<ContainerType, Record<ContainerSize, TechnicalPreset>> = {
  "Box Standard": {
    "20'": { lengthM: 6.06, widthM: 2.44, heightM: 2.59, volumeM3: 33.2 },
    "40'": { lengthM: 12.19, widthM: 2.44, heightM: 2.59, volumeM3: 67.7 },
    "40HC": { lengthM: 12.19, widthM: 2.44, heightM: 2.9, volumeM3: 76.4 }
  },
  Reefer: {
    "20'": { lengthM: 6.06, widthM: 2.44, heightM: 2.59, volumeM3: 28.4 },
    "40'": { lengthM: 12.19, widthM: 2.44, heightM: 2.59, volumeM3: 59.3 },
    "40HC": { lengthM: 12.19, widthM: 2.44, heightM: 2.9, volumeM3: 67.3 }
  },
  "Uso ufficio": {
    "20'": { lengthM: 6.06, widthM: 2.44, heightM: 2.59, volumeM3: 33.2 },
    "40'": { lengthM: 12.19, widthM: 2.44, heightM: 2.59, volumeM3: 67.7 },
    "40HC": { lengthM: 12.19, widthM: 2.44, heightM: 2.9, volumeM3: 76.4 }
  }
};

function normalizeContainerType(value: string): ContainerType {
  const normalized = value.toLowerCase();
  if (normalized.includes("reefer")) return "Reefer";
  if (normalized.includes("ufficio") || normalized.includes("office")) return "Uso ufficio";
  return "Box Standard";
}

function normalizeContainerSize(value: string): ContainerSize {
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("hc") || normalized.includes("highcube")) return "40HC";
  if (normalized.startsWith("40")) return "40'";
  return "20'";
}

function applyTechnicalPreset(product: ProductPayload, type: ContainerType, size: ContainerSize): ProductPayload {
  return { ...product, type, size, ...CONTAINER_PRESETS[type][size] };
}

const emptyProduct: ProductPayload = applyTechnicalPreset({
  slug: "",
  title: "",
  size: "20'",
  type: "Box Standard",
  condition: "Usato · Ottime condizioni strutturali",
  location: "Salerno",
  price: null,
  vatIncluded: false,
  availability: null,
  description: "",
  imageUrl: null,
  lengthM: null,
  widthM: null,
  heightM: null,
  volumeM3: null,
  isPublished: false
}, "Box Standard", "20'");

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function num(value: string) {
  if (value === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductPayload>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingImages, setEditingImages] = useState<MediaAsset[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try { setProducts(await adminApi.products.list()); }
    catch (e) { setError(e instanceof Error ? e.message : "Backend non raggiungibile"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? products.filter((p) => `${p.title} ${p.type} ${p.size} ${p.location}`.toLowerCase().includes(q)) : products;
  }, [products, query]);

  function createNew() {
    setEditingId(null);
    setEditingImages([]);
    setForm({ ...emptyProduct });
    setEditorOpen(true);
    setError(""); setNotice("");
  }

  function edit(product: Product) {
    const type = normalizeContainerType(product.type);
    const size = normalizeContainerSize(product.size);
    setEditingId(product.id);
    setEditingImages(product.images ?? []);
    setForm(applyTechnicalPreset({
      slug: product.slug, title: product.title, size, type, condition: product.condition,
      location: product.location, price: product.price, vatIncluded: product.vatIncluded, availability: product.availability,
      description: product.description, imageUrl: product.externalImageUrl ?? null, lengthM: product.lengthM ?? null,
      widthM: product.widthM ?? null, heightM: product.heightM ?? null, volumeM3: product.volumeM3 ?? null,
      isPublished: Boolean(product.isPublished)
    }, type, size));
    setEditorOpen(true);
    setError(""); setNotice("");
  }

  function changeType(value: string) {
    const type = value as ContainerType;
    setForm((current) => applyTechnicalPreset(current, type, normalizeContainerSize(current.size)));
  }

  function changeSize(value: string) {
    const size = value as ContainerSize;
    setForm((current) => applyTechnicalPreset(current, normalizeContainerType(current.type), size));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = { ...form, slug: form.slug || slugify(form.title), imageUrl: form.imageUrl || null };
      const saved = editingId ? await adminApi.products.update(editingId, payload) : await adminApi.products.create(payload);
      setEditingId(saved.id);
      setEditingImages(saved.images ?? editingImages);
      setForm({ ...payload, imageUrl: saved.externalImageUrl ?? payload.imageUrl ?? null });
      setNotice(editingId ? "Prodotto aggiornato." : "Prodotto creato. Ora puoi caricare le fotografie nella galleria qui sotto.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Salvataggio non riuscito"); }
    finally { setSaving(false); }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Eliminare definitivamente “${product.title}”?`)) return;
    try { await adminApi.products.remove(product.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Eliminazione non riuscita"); }
  }

  async function togglePublished(product: Product) {
    try {
      await adminApi.products.update(product.id, {
        slug: product.slug, title: product.title, size: product.size, type: product.type, condition: product.condition,
        location: product.location, price: product.price, vatIncluded: product.vatIncluded, availability: product.availability,
        description: product.description, imageUrl: product.externalImageUrl ?? null, lengthM: product.lengthM ?? null,
        widthM: product.widthM ?? null, heightM: product.heightM ?? null, volumeM3: product.volumeM3 ?? null,
        isPublished: !product.isPublished
      });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Aggiornamento non riuscito"); }
  }

  return (
    <>
      <header className="admin-head">
        <div><div className="eyebrow">CATALOGO COMMERCIALE</div><h1>Prodotti</h1><p className="admin-subtitle">Crea le tipologie commerciali mostrate sul sito e gestisci prezzi, disponibilità, pubblicazione e fotografie.</p></div>
        <button className="button button-dark" onClick={createNew}>+ Nuovo prodotto</button>
      </header>

      {error && <div className="admin-alert error">{error}</div>}
      {notice && <div className="admin-alert success">{notice}</div>}

      {editorOpen && (
        <section className="admin-panel admin-editor">
          <div className="editor-head"><div><div className="eyebrow">{editingId ? "MODIFICA" : "NUOVO"}</div><h2>{editingId ? "Modifica prodotto" : "Nuovo prodotto"}</h2></div><button className="icon-button" onClick={() => setEditorOpen(false)} aria-label="Chiudi">×</button></div>
          <form onSubmit={save}>
            <div className="form-grid">
              <label className="span-2">Titolo<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: editingId ? form.slug : slugify(e.target.value) })} placeholder="Container 40' High Cube" /></label>
              <label>Slug<input required value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></label>
              <label>Tipologia<select required value={normalizeContainerType(form.type)} onChange={(e) => changeType(e.target.value)}>{CONTAINER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label>Dimensione<select required value={normalizeContainerSize(form.size)} onChange={(e) => changeSize(e.target.value)}>{CONTAINER_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
              <label>Condizione<input required value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} /></label>
              <label>Località<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
              <label>Prezzo €<input type="number" step="0.01" min="0" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: num(e.target.value) })} placeholder="Vuoto = su richiesta" /></label>
              <label>Disponibilità<input type="number" min="0" value={form.availability ?? ""} onChange={(e) => setForm({ ...form, availability: num(e.target.value) })} placeholder="Vuoto = da confermare" /></label>
              <label>Lunghezza m<input type="number" value={form.lengthM ?? ""} readOnly title="Compilata automaticamente in base a tipologia e dimensione" /></label>
              <label>Larghezza m<input type="number" value={form.widthM ?? ""} readOnly title="Compilata automaticamente in base a tipologia e dimensione" /></label>
              <label>Altezza m<input type="number" value={form.heightM ?? ""} readOnly title="Compilata automaticamente in base a tipologia e dimensione" /></label>
              <label>Volume m³<input type="number" value={form.volumeM3 ?? ""} readOnly title="Compilato automaticamente in base a tipologia e dimensione" /></label>
              <label className="span-2">URL immagine esterna / legacy (opzionale)<input value={form.imageUrl ?? ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value || null })} placeholder="Solo per immagini esterne; le foto caricate si gestiscono dalla galleria" /></label>
              <label className="span-4">Descrizione<textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            </div>
            <div className="check-row"><label><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Pubblica nella vetrina</label><label><input type="checkbox" checked={form.vatIncluded} onChange={(e) => setForm({ ...form, vatIncluded: e.target.checked })} /> Prezzo IVA inclusa</label></div>
            <div className="form-actions"><button type="button" className="button button-outline" onClick={() => setEditorOpen(false)}>Chiudi</button><button disabled={saving} className="button button-dark">{saving ? "Salvataggio…" : editingId ? "Salva modifiche" : "Crea prodotto"}</button></div>
          </form>
          {editingId ? <MediaManager entityType="product" entityId={editingId} initialImages={editingImages} onChanged={(images) => { setEditingImages(images); void load(); }} /> : <div className="media-save-first">Salva prima il prodotto; subito dopo potrai caricare una o più fotografie.</div>}
        </section>
      )}

      <section className="admin-panel table-wrap">
        <div className="table-toolbar"><input className="admin-search" placeholder="Cerca prodotto, tipo, deposito…" value={query} onChange={(e) => setQuery(e.target.value)} /><span>{filtered.length} prodotti</span></div>
        <table><thead><tr><th>Prodotto</th><th>Foto</th><th>Località</th><th>Disponibilità</th><th>Prezzo</th><th>Vetrina</th><th>Azioni</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7}>Caricamento…</td></tr> : filtered.length === 0 ? <tr><td colSpan={7}>Nessun prodotto.</td></tr> : filtered.map((p) => <tr key={p.id}>
            <td><strong>{p.title}</strong><small>{p.size} · {p.type} · {p.condition}</small></td>
            <td>{p.imageUrl ? <img className="admin-table-thumb" src={p.imageUrl} alt="" /> : <span className="no-photo">—</span>}<small>{p.images?.length ? `${p.images.length} foto` : "Nessuna foto"}</small></td>
            <td>{p.location || "—"}</td><td>{p.availability ?? "Da confermare"}</td><td>{p.price !== null ? `€ ${p.price.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "Su richiesta"}</td>
            <td><button className={`status-button ${p.isPublished ? "published" : "draft"}`} onClick={() => void togglePublished(p)}>{p.isPublished ? "PUBBLICATO" : "BOZZA"}</button></td>
            <td><div className="row-actions"><button onClick={() => edit(p)}>Modifica</button><button className="danger" onClick={() => void remove(p)}>Elimina</button></div></td>
          </tr>)}</tbody>
        </table>
      </section>
    </>
  );
}
