import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { newId, readLocalDb, writeLocalDb } from "../lib/localStore.js";
import { fetchSupabaseMediaMap, localMediaMap, type MediaAsset } from "../lib/media.js";

const nullableNumber = z.number().finite().nullable().optional();
const productSchema = z.object({
  slug: z.string().trim().min(2).max(160),
  title: z.string().trim().min(2).max(160),
  size: z.string().trim().min(1).max(50),
  type: z.string().trim().min(1).max(80),
  condition: z.string().trim().min(1).max(160),
  location: z.string().trim().max(160).default("Salerno"),
  price: nullableNumber,
  vatIncluded: z.boolean().default(false),
  availability: z.number().int().min(0).nullable().optional(),
  description: z.string().trim().max(6000).default(""),
  imageUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  lengthM: nullableNumber,
  widthM: nullableNumber,
  heightM: nullableNumber,
  volumeM3: nullableNumber,
  isPublished: z.boolean().default(false)
});

type ProductInput = z.infer<typeof productSchema>;

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isManagedMediaUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  const url = value.trim();
  return url.includes("/uploads/products/")
    || url.includes("/uploads/containers/")
    || /\/storage\/v1\/object\/public\/[^/]+\/(products|containers)\//.test(url);
}

function mapProduct(row: any, images: MediaAsset[] = []) {
  const orderedImages = images.slice().sort((a, b) => a.position - b.position);
  const primary = orderedImages.find((image) => image.isPrimary) ?? orderedImages[0];
  const storedImageUrl = row.image_url ?? row.imageUrl ?? null;
  // image_url e' riservato al fallback esterno/legacy. Nelle versioni precedenti
  // poteva essere contaminato con l'URL di una foto gestita dalla galleria.
  // Ignoriamo questi URL gestiti se il relativo media asset non esiste piu'.
  const externalImageUrl = isManagedMediaUrl(storedImageUrl) ? null : storedImageUrl;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    size: row.size,
    type: row.type,
    condition: row.condition,
    location: row.location ?? row.depots?.name ?? "Da definire",
    price: numberOrNull(row.price),
    vatIncluded: Boolean(row.vat_included ?? row.vatIncluded),
    availability: numberOrNull(row.availability),
    description: row.description ?? "",
    imageUrl: primary?.url ?? externalImageUrl ?? null,
    externalImageUrl,
    images: orderedImages,
    lengthM: numberOrNull(row.length_m ?? row.lengthM),
    widthM: numberOrNull(row.width_m ?? row.widthM),
    heightM: numberOrNull(row.height_m ?? row.heightM),
    volumeM3: numberOrNull(row.volume_m3 ?? row.volumeM3),
    isPublished: Boolean(row.is_published ?? row.isPublished),
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null
  };
}

function toDb(input: ProductInput) {
  return {
    slug: input.slug,
    title: input.title,
    size: input.size,
    type: input.type,
    condition: input.condition,
    location: input.location || null,
    price: input.price ?? null,
    vat_included: input.vatIncluded,
    availability: input.availability ?? null,
    description: input.description,
    image_url: input.imageUrl || null,
    length_m: input.lengthM ?? null,
    width_m: input.widthM ?? null,
    height_m: input.heightM ?? null,
    volume_m3: input.volumeM3 ?? null,
    is_published: input.isPublished,
    updated_at: new Date().toISOString()
  };
}

function toLocal(input: ProductInput) {
  return {
    slug: input.slug,
    title: input.title,
    size: input.size,
    type: input.type,
    condition: input.condition,
    location: input.location,
    price: input.price ?? null,
    vatIncluded: input.vatIncluded,
    availability: input.availability ?? null,
    description: input.description,
    imageUrl: input.imageUrl || null,
    lengthM: input.lengthM ?? null,
    widthM: input.widthM ?? null,
    heightM: input.heightM ?? null,
    volumeM3: input.volumeM3 ?? null,
    isPublished: input.isPublished
  };
}

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products", async () => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("products").select("*").eq("is_published", true).order("created_at", { ascending: false });
      if (!error) {
        const mediaMap = await fetchSupabaseMediaMap(supabase, "product", (data ?? []).map((item) => item.id));
        return (data ?? []).map((item) => mapProduct(item, mediaMap.get(item.id) ?? []));
      }
      app.log.warn(error, "Supabase products fallback locale");
    }
    const db = await readLocalDb();
    const rows = db.products.filter((item) => item.isPublished);
    const mediaMap = localMediaMap(db.mediaAssets, "product", rows.map((item) => item.id));
    return rows.map((item) => mapProduct(item, mediaMap.get(item.id) ?? []));
  });

  app.get<{ Params: { slug: string } }>("/api/products/:slug", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("products").select("*").eq("slug", request.params.slug).eq("is_published", true).maybeSingle();
      if (!error && data) {
        const mediaMap = await fetchSupabaseMediaMap(supabase, "product", [data.id]);
        return mapProduct(data, mediaMap.get(data.id) ?? []);
      }
    }
    const db = await readLocalDb();
    const product = db.products.find((item) => item.slug === request.params.slug && item.isPublished);
    if (!product) return reply.code(404).send({ error: "Prodotto non trovato" });
    const mediaMap = localMediaMap(db.mediaAssets, "product", [product.id]);
    return mapProduct(product, mediaMap.get(product.id) ?? []);
  });

  app.get("/api/admin/products", async () => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (!error) {
        const mediaMap = await fetchSupabaseMediaMap(supabase, "product", (data ?? []).map((item) => item.id));
        return (data ?? []).map((item) => mapProduct(item, mediaMap.get(item.id) ?? []));
      }
      app.log.warn(error, "Supabase admin products fallback locale");
    }
    const db = await readLocalDb();
    const rows = db.products.slice().reverse();
    const mediaMap = localMediaMap(db.mediaAssets, "product", rows.map((item) => item.id));
    return rows.map((item) => mapProduct(item, mediaMap.get(item.id) ?? []));
  });

  app.post("/api/admin/products", async (request, reply) => {
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dati prodotto non validi", details: parsed.error.flatten() });

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("products").insert(toDb(parsed.data)).select("*").single();
      if (error) return reply.code(400).send({ error: error.message });
      return reply.code(201).send(mapProduct(data));
    }

    const db = await readLocalDb();
    if (db.products.some((item) => item.slug === parsed.data.slug)) return reply.code(409).send({ error: "Slug già utilizzato" });
    const now = new Date().toISOString();
    const created = { id: newId(), ...toLocal(parsed.data), createdAt: now, updatedAt: now };
    db.products.push(created as any);
    await writeLocalDb(db);
    return reply.code(201).send(mapProduct(created));
  });

  app.put<{ Params: { id: string } }>("/api/admin/products/:id", async (request, reply) => {
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dati prodotto non validi", details: parsed.error.flatten() });

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.from("products").update(toDb(parsed.data)).eq("id", request.params.id).select("*").maybeSingle();
      if (error) return reply.code(400).send({ error: error.message });
      if (!data) return reply.code(404).send({ error: "Prodotto non trovato" });
      const mediaMap = await fetchSupabaseMediaMap(supabase, "product", [data.id]);
      return mapProduct(data, mediaMap.get(data.id) ?? []);
    }

    const db = await readLocalDb();
    const index = db.products.findIndex((item) => item.id === request.params.id);
    if (index < 0) return reply.code(404).send({ error: "Prodotto non trovato" });
    if (db.products.some((item) => item.slug === parsed.data.slug && item.id !== request.params.id)) return reply.code(409).send({ error: "Slug già utilizzato" });
    const updated = { ...db.products[index], ...toLocal(parsed.data), updatedAt: new Date().toISOString() };
    db.products[index] = updated as any;
    await writeLocalDb(db);
    const mediaMap = localMediaMap(db.mediaAssets, "product", [updated.id]);
    return mapProduct(updated, mediaMap.get(updated.id) ?? []);
  });

  app.delete<{ Params: { id: string } }>("/api/admin/products/:id", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error, count } = await supabase.from("products").delete({ count: "exact" }).eq("id", request.params.id);
      if (error) return reply.code(400).send({ error: error.message });
      if (!count) return reply.code(404).send({ error: "Prodotto non trovato" });
      return reply.code(204).send();
    }

    const db = await readLocalDb();
    const exists = db.products.some((item) => item.id === request.params.id);
    if (!exists) return reply.code(404).send({ error: "Prodotto non trovato" });
    db.products = db.products.filter((item) => item.id !== request.params.id);
    db.containers = db.containers.map((item) => item.productId === request.params.id ? { ...item, productId: null } : item);
    db.mediaAssets = db.mediaAssets.filter((item) => item.productId !== request.params.id);
    await writeLocalDb(db);
    return reply.code(204).send();
  });
}
