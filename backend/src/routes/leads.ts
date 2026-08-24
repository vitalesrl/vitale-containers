import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { newId, readLocalDb, writeLocalDb } from "../lib/localStore.js";

const leadSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(2),
  company: z.string().optional(),
  vatNumber: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(5),
  destination: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  transportRequired: z.boolean().default(false),
  message: z.string().optional()
});

const leadStatusSchema = z.object({ status: z.enum(["new", "contacted", "quoted", "won", "lost"]) });

function mapLead(row: any) {
  return {
    id: row.id,
    productId: row.product_id ?? row.productId ?? null,
    productTitle: row.products?.title ?? row.productTitle ?? null,
    name: row.name,
    company: row.company ?? "",
    vatNumber: row.vat_number ?? row.vatNumber ?? "",
    email: row.email,
    phone: row.phone,
    destination: row.destination ?? "",
    quantity: row.quantity ?? 1,
    transportRequired: Boolean(row.transport_required ?? row.transportRequired),
    message: row.message ?? "",
    status: row.status,
    createdAt: row.created_at ?? row.createdAt
  };
}

export async function leadRoutes(app: FastifyInstance) {
  app.post("/api/leads", async (request, reply) => {
    const parsed = leadSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dati non validi", details: parsed.error.flatten() });
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("leads").insert({ product_id: parsed.data.productId ?? null, name: parsed.data.name, company: parsed.data.company ?? null, vat_number: parsed.data.vatNumber ?? null, email: parsed.data.email, phone: parsed.data.phone, destination: parsed.data.destination ?? null, quantity: parsed.data.quantity, transport_required: parsed.data.transportRequired, message: parsed.data.message ?? null }).select("id,status").single();
      if (error) return reply.code(500).send({ error: "Impossibile salvare la richiesta" });
      return reply.code(201).send(data);
    }
    const db = await readLocalDb();
    const created = {
      id: newId(), productId: parsed.data.productId ?? null, name: parsed.data.name, company: parsed.data.company ?? "", vatNumber: parsed.data.vatNumber ?? "", email: parsed.data.email, phone: parsed.data.phone, destination: parsed.data.destination ?? "", quantity: parsed.data.quantity, transportRequired: parsed.data.transportRequired, message: parsed.data.message ?? "", status: "new" as const, createdAt: new Date().toISOString()
    };
    db.leads.push(created);
    await writeLocalDb(db);
    return reply.code(201).send({ id: created.id, status: created.status });
  });

  app.get("/api/admin/leads", async () => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("leads").select("*, products(title)").order("created_at", { ascending: false });
      if (!error) return data.map(mapLead);
      app.log.warn(error, "Supabase leads fallback locale");
    }
    const db = await readLocalDb();
    return db.leads.slice().reverse().map((lead) => mapLead({ ...lead, productTitle: db.products.find((product) => product.id === lead.productId)?.title ?? null }));
  });

  app.patch<{ Params: { id: string } }>("/api/admin/leads/:id/status", async (request, reply) => {
    const parsed = leadStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Stato non valido" });
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("leads").update({ status: parsed.data.status }).eq("id", request.params.id).select("*, products(title)").maybeSingle();
      if (error) return reply.code(400).send({ error: error.message });
      if (!data) return reply.code(404).send({ error: "Richiesta non trovata" });
      return mapLead(data);
    }
    const db = await readLocalDb();
    const index = db.leads.findIndex((lead) => lead.id === request.params.id);
    if (index < 0) return reply.code(404).send({ error: "Richiesta non trovata" });
    db.leads[index] = { ...db.leads[index], status: parsed.data.status };
    await writeLocalDb(db);
    return mapLead(db.leads[index]);
  });

  app.delete<{ Params: { id: string } }>("/api/admin/leads/:id", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error, count } = await supabase.from("leads").delete({ count: "exact" }).eq("id", request.params.id);
      if (error) return reply.code(400).send({ error: error.message });
      if (!count) return reply.code(404).send({ error: "Richiesta non trovata" });
      return reply.code(204).send();
    }
    const db = await readLocalDb();
    const exists = db.leads.some((lead) => lead.id === request.params.id);
    if (!exists) return reply.code(404).send({ error: "Richiesta non trovata" });
    db.leads = db.leads.filter((lead) => lead.id !== request.params.id);
    await writeLocalDb(db);
    return reply.code(204).send();
  });
}
