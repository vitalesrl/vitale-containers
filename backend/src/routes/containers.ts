import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { newId, readLocalDb, writeLocalDb } from "../lib/localStore.js";
import { fetchSupabaseMediaMap, localMediaMap, type MediaAsset } from "../lib/media.js";

const nullableNumber = z.number().finite().nullable().optional();
const containerSchema = z.object({
  productId: z.string().nullable().optional(),
  containerNumber: z.string().trim().min(4).max(20),
  status: z.enum(["available", "reserved", "sold", "incoming", "unavailable"]).default("available"),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  manufacturer: z.string().trim().max(120).default(""),
  color: z.string().trim().max(80).default(""),
  tareKg: nullableNumber,
  cscExpiry: z.string().nullable().optional(),
  purchasePrice: nullableNumber,
  salePrice: nullableNumber,
  notes: z.string().trim().max(4000).default("")
});

type ContainerInput = z.infer<typeof containerSchema>;

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapContainer(row: any, images: MediaAsset[] = []) {
  const orderedImages = images.slice().sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    productId: row.product_id ?? row.productId ?? null,
    productTitle: row.products?.title ?? row.productTitle ?? null,
    containerNumber: row.container_number ?? row.containerNumber,
    status: row.status,
    year: numberOrNull(row.year),
    manufacturer: row.manufacturer ?? "",
    color: row.color ?? "",
    tareKg: numberOrNull(row.tare_kg ?? row.tareKg),
    cscExpiry: row.csc_expiry ?? row.cscExpiry ?? null,
    purchasePrice: numberOrNull(row.purchase_price ?? row.purchasePrice),
    salePrice: numberOrNull(row.sale_price ?? row.salePrice),
    notes: row.notes ?? "",
    images: orderedImages,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null
  };
}

function toDb(input: ContainerInput) {
  return {
    product_id: input.productId || null,
    container_number: input.containerNumber.toUpperCase(),
    status: input.status,
    year: input.year ?? null,
    manufacturer: input.manufacturer || null,
    color: input.color || null,
    tare_kg: input.tareKg ?? null,
    csc_expiry: input.cscExpiry || null,
    purchase_price: input.purchasePrice ?? null,
    sale_price: input.salePrice ?? null,
    notes: input.notes || null,
    updated_at: new Date().toISOString()
  };
}

function toLocal(input: ContainerInput) {
  return {
    productId: input.productId || null,
    containerNumber: input.containerNumber.toUpperCase(),
    status: input.status,
    year: input.year ?? null,
    manufacturer: input.manufacturer,
    color: input.color,
    tareKg: input.tareKg ?? null,
    cscExpiry: input.cscExpiry || null,
    purchasePrice: input.purchasePrice ?? null,
    salePrice: input.salePrice ?? null,
    notes: input.notes
  };
}

export async function containerRoutes(app: FastifyInstance) {
  app.get("/api/admin/containers", async () => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("containers").select("*, products(title)").order("created_at", { ascending: false });
      if (!error) {
        const mediaMap = await fetchSupabaseMediaMap(supabase, "container", (data ?? []).map((item) => item.id));
        return (data ?? []).map((item) => mapContainer(item, mediaMap.get(item.id) ?? []));
      }
      app.log.warn(error, "Supabase containers fallback locale");
    }
    const db = await readLocalDb();
    const rows = db.containers.slice().reverse();
    const mediaMap = localMediaMap(db.mediaAssets, "container", rows.map((item) => item.id));
    return rows.map((item) => mapContainer({ ...item, productTitle: db.products.find((product) => product.id === item.productId)?.title ?? null }, mediaMap.get(item.id) ?? []));
  });

  app.post("/api/admin/containers", async (request, reply) => {
    const parsed = containerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dati container non validi", details: parsed.error.flatten() });
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("containers").insert(toDb(parsed.data)).select("*, products(title)").single();
      if (error) return reply.code(400).send({ error: error.message });
      return reply.code(201).send(mapContainer(data));
    }
    const db = await readLocalDb();
    const number = parsed.data.containerNumber.toUpperCase();
    if (db.containers.some((item) => item.containerNumber === number)) return reply.code(409).send({ error: "Numero container già presente" });
    const now = new Date().toISOString();
    const created = { id: newId(), ...toLocal(parsed.data), createdAt: now, updatedAt: now };
    db.containers.push(created);
    await writeLocalDb(db);
    return reply.code(201).send(mapContainer({ ...created, productTitle: db.products.find((product) => product.id === created.productId)?.title ?? null }));
  });

  app.put<{ Params: { id: string } }>("/api/admin/containers/:id", async (request, reply) => {
    const parsed = containerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dati container non validi", details: parsed.error.flatten() });
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("containers").update(toDb(parsed.data)).eq("id", request.params.id).select("*, products(title)").maybeSingle();
      if (error) return reply.code(400).send({ error: error.message });
      if (!data) return reply.code(404).send({ error: "Container non trovato" });
      const mediaMap = await fetchSupabaseMediaMap(supabase, "container", [data.id]);
      return mapContainer(data, mediaMap.get(data.id) ?? []);
    }
    const db = await readLocalDb();
    const index = db.containers.findIndex((item) => item.id === request.params.id);
    if (index < 0) return reply.code(404).send({ error: "Container non trovato" });
    const number = parsed.data.containerNumber.toUpperCase();
    if (db.containers.some((item) => item.containerNumber === number && item.id !== request.params.id)) return reply.code(409).send({ error: "Numero container già presente" });
    const updated = { ...db.containers[index], ...toLocal(parsed.data), updatedAt: new Date().toISOString() };
    db.containers[index] = updated;
    await writeLocalDb(db);
    const mediaMap = localMediaMap(db.mediaAssets, "container", [updated.id]);
    return mapContainer({ ...updated, productTitle: db.products.find((product) => product.id === updated.productId)?.title ?? null }, mediaMap.get(updated.id) ?? []);
  });

  app.delete<{ Params: { id: string } }>("/api/admin/containers/:id", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error, count } = await supabase.from("containers").delete({ count: "exact" }).eq("id", request.params.id);
      if (error) return reply.code(400).send({ error: error.message });
      if (!count) return reply.code(404).send({ error: "Container non trovato" });
      return reply.code(204).send();
    }
    const db = await readLocalDb();
    const exists = db.containers.some((item) => item.id === request.params.id);
    if (!exists) return reply.code(404).send({ error: "Container non trovato" });
    db.containers = db.containers.filter((item) => item.id !== request.params.id);
    db.mediaAssets = db.mediaAssets.filter((item) => item.containerId !== request.params.id);
    await writeLocalDb(db);
    return reply.code(204).send();
  });
}
