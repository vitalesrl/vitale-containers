"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import type { Lead, LeadStatus } from "@/lib/types";

const statusLabels: Record<LeadStatus, string> = { new: "Nuova", contacted: "Contattata", quoted: "Preventivo", won: "Acquisita", lost: "Persa" };

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); try { setLeads(await adminApi.leads.list()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Backend non raggiungibile"); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => { const q = query.toLowerCase().trim(); return q ? leads.filter((l) => `${l.name} ${l.company} ${l.email} ${l.phone} ${l.destination}`.toLowerCase().includes(q)) : leads; }, [leads, query]);
  async function changeStatus(id: string, status: LeadStatus) { try { await adminApi.leads.setStatus(id, status); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Aggiornamento non riuscito"); } }
  async function remove(lead: Lead) { if (!confirm(`Eliminare la richiesta di ${lead.name}?`)) return; try { await adminApi.leads.remove(lead.id); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Eliminazione non riuscita"); } }
  return <>
    <header className="admin-head"><div><div className="eyebrow">CRM</div><h1>Richieste</h1><p className="admin-subtitle">Richieste commerciali ricevute dalla vetrina e avanzamento della trattativa.</p></div></header>
    {error && <div className="admin-alert error">{error}</div>}
    <section className="admin-panel table-wrap"><div className="table-toolbar"><input className="admin-search" placeholder="Cerca cliente, email, destinazione…" value={query} onChange={(e) => setQuery(e.target.value)} /><span>{filtered.length} richieste</span></div>
      <table><thead><tr><th>Cliente</th><th>Prodotto</th><th>Contatti</th><th>Destinazione</th><th>Q.tà</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}>Caricamento…</td></tr> : filtered.length === 0 ? <tr><td colSpan={7}>Nessuna richiesta ricevuta.</td></tr> : filtered.map((lead) => <tr key={lead.id}><td><strong>{lead.name}</strong><small>{lead.company || "Privato"}</small></td><td>{lead.productTitle ?? "Generica"}</td><td><a href={`mailto:${lead.email}`}>{lead.email}</a><small><a href={`tel:${lead.phone}`}>{lead.phone}</a></small></td><td>{lead.destination || "—"}{lead.transportRequired && <small>Trasporto richiesto</small>}</td><td>{lead.quantity}</td><td><select className="status-select" value={lead.status} onChange={(e) => void changeStatus(lead.id, e.target.value as LeadStatus)}>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></td><td><div className="row-actions"><button className="danger" onClick={() => void remove(lead)}>Elimina</button></div></td></tr>)}</tbody></table>
    </section>
  </>;
}
