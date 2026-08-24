import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { newId, readLocalDb, writeLocalDb } from "../lib/localStore.js";
import {
  allowedImageMimeTypes,
  deleteImageFile,
  entityColumn,
  entityLocalKey,
  mapMediaAsset,
  mediaForEntity,
  saveImageFile,
  type MediaEntityType
} from "../lib/media.js";

const entityTypeSchema = z.enum(["product", "container"]);
const orderSchema = z.object({ ids: z.array(z.string().min(1)).max(30) });

async function ensureEntity(type: MediaEntityType, id: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const table = type === "product" ? "products" : "containers";
    const { data, error } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
    return !error && Boolean(data);
  }
  const db = await readLocalDb();
  return type === "product" ? db.products.some((item) => item.id === id) : db.containers.some((item) => item.id === id);
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get<{ Params: { type: string; id: string } }>("/api/admin/media/:type/:id", async (request, reply) => {
    const parsedType = entityTypeSchema.safeParse(request.params.type);
    if (!parsedType.success) return reply.code(400).send({ error: "Tipo media non valido" });
    const type = parsedType.data;
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const column = entityColumn(type);
      const { data, error } = await supabase.from("media_assets").select("*").eq(column, request.params.id).order("position", { ascending: true });
      if (error) return reply.code(400).send({ error: error.message });
      return (data ?? []).map(mapMediaAsset);
    }
    const db = await readLocalDb();
    return mediaForEntity(db.mediaAssets, type, request.params.id);
  });

  app.post<{ Params: { type: string; id: string } }>("/api/admin/media/:type/:id", async (request, reply) => {
    const parsedType = entityTypeSchema.safeParse(request.params.type);
    if (!parsedType.success) return reply.code(400).send({ error: "Tipo media non valido" });
    const type = parsedType.data;
    const entityId = request.params.id;
    if (!(await ensureEntity(type, entityId))) return reply.code(404).send({ error: type === "product" ? "Prodotto non trovato" : "Container non trovato" });

    const supabase = getSupabaseAdmin();
    let existingCount = 0;
    let alreadyHasPrimary = false;
    if (supabase) {
      const column = entityColumn(type);
      const { data, error } = await supabase.from("media_assets").select("id,is_primary").eq(column, entityId);
      if (error) return reply.code(400).send({ error: error.message });
      existingCount = data?.length ?? 0;
      alreadyHasPrimary = Boolean(data?.some((item) => item.is_primary));
    } else {
      const db = await readLocalDb();
      const media = mediaForEntity(db.mediaAssets, type, entityId);
      existingCount = media.length;
      alreadyHasPrimary = media.some((item) => item.isPrimary);
    }

    const uploaded: any[] = [];
    try {
      for await (const part of request.files()) {
        if (!allowedImageMimeTypes.has(part.mimetype)) {
          await part.toBuffer();
          return reply.code(415).send({ error: `Formato non supportato: ${part.mimetype}. Usa JPG, PNG, WEBP o AVIF.` });
        }
        if (existingCount + uploaded.length >= 20) {
          await part.toBuffer();
          return reply.code(400).send({ error: "Massimo 20 fotografie per scheda" });
        }
        const buffer = await part.toBuffer();
        const stored = await saveImageFile({ type, entityId, filename: part.filename, mimeType: part.mimetype, buffer, supabase });
        const now = new Date().toISOString();
        const isPrimary = !alreadyHasPrimary && uploaded.length === 0;
        const row = {
          id: newId(),
          product_id: type === "product" ? entityId : null,
          container_id: type === "container" ? entityId : null,
          storage_provider: stored.storageProvider,
          storage_path: stored.storagePath,
          public_url: stored.publicUrl,
          original_name: part.filename,
          mime_type: part.mimetype,
          size_bytes: buffer.length,
          position: existingCount + uploaded.length,
          is_primary: isPrimary,
          created_at: now
        };
        if (supabase) {
          const { data, error } = await supabase.from("media_assets").insert(row).select("*").single();
          if (error) throw new Error(error.message);
          uploaded.push(mapMediaAsset(data));
        } else {
          const db = await readLocalDb();
          const localRow = {
            id: row.id,
            productId: row.product_id,
            containerId: row.container_id,
            storageProvider: row.storage_provider,
            storagePath: row.storage_path,
            url: row.public_url,
            originalName: row.original_name,
            mimeType: row.mime_type,
            sizeBytes: row.size_bytes,
            position: row.position,
            isPrimary: row.is_primary,
            createdAt: row.created_at
          };
          db.mediaAssets.push(localRow);
          await writeLocalDb(db);
          uploaded.push(mapMediaAsset(localRow));
        }
      }
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Upload non riuscito" });
    }
    if (!uploaded.length) return reply.code(400).send({ error: "Seleziona almeno una fotografia" });
    return reply.code(201).send(uploaded);
  });

  app.patch<{ Params: { mediaId: string } }>("/api/admin/media/:mediaId/primary", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: asset, error } = await supabase.from("media_assets").select("*").eq("id", request.params.mediaId).maybeSingle();
      if (error) return reply.code(400).send({ error: error.message });
      if (!asset) return reply.code(404).send({ error: "Foto non trovata" });
      const column = asset.product_id ? "product_id" : "container_id";
      const entityId = asset.product_id ?? asset.container_id;
      const { error: clearError } = await supabase.from("media_assets").update({ is_primary: false }).eq(column, entityId);
      if (clearError) return reply.code(400).send({ error: clearError.message });
      const { data, error: setError } = await supabase.from("media_assets").update({ is_primary: true }).eq("id", request.params.mediaId).select("*").single();
      if (setError) return reply.code(400).send({ error: setError.message });
      return mapMediaAsset(data);
    }

    const db = await readLocalDb();
    const index = db.mediaAssets.findIndex((item) => item.id === request.params.mediaId);
    if (index < 0) return reply.code(404).send({ error: "Foto non trovata" });
    const target = db.mediaAssets[index];
    const key = target.productId ? "productId" : "containerId";
    const entityId = target.productId ?? target.containerId;
    db.mediaAssets = db.mediaAssets.map((item) => item[key] === entityId ? { ...item, isPrimary: item.id === target.id } : item);
    await writeLocalDb(db);
    return mapMediaAsset(db.mediaAssets.find((item) => item.id === target.id));
  });

  app.put<{ Params: { type: string; id: string } }>("/api/admin/media/:type/:id/order", async (request, reply) => {
    const parsedType = entityTypeSchema.safeParse(request.params.type);
    const parsed = orderSchema.safeParse(request.body);
    if (!parsedType.success || !parsed.success) return reply.code(400).send({ error: "Ordine fotografie non valido" });
    const type = parsedType.data;
    const ids = parsed.data.ids;
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const column = entityColumn(type);
      for (let position = 0; position < ids.length; position++) {
        const { error } = await supabase.from("media_assets").update({ position }).eq("id", ids[position]).eq(column, request.params.id);
        if (error) return reply.code(400).send({ error: error.message });
      }
      const { data, error } = await supabase.from("media_assets").select("*").eq(column, request.params.id).order("position", { ascending: true });
      if (error) return reply.code(400).send({ error: error.message });
      return (data ?? []).map(mapMediaAsset);
    }
    const db = await readLocalDb();
    const key = entityLocalKey(type);
    const positions = new Map(ids.map((id, index) => [id, index]));
    db.mediaAssets = db.mediaAssets.map((item) => item[key] === request.params.id && positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item);
    await writeLocalDb(db);
    return mediaForEntity(db.mediaAssets, type, request.params.id);
  });

  app.delete<{ Params: { mediaId: string } }>("/api/admin/media/:mediaId", async (request, reply) => {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: row, error } = await supabase.from("media_assets").select("*").eq("id", request.params.mediaId).maybeSingle();
      if (error) return reply.code(400).send({ error: error.message });
      if (!row) return reply.code(404).send({ error: "Foto non trovata" });
      const asset = mapMediaAsset(row);
      try { await deleteImageFile(asset, supabase); } catch (error) { request.log.warn(error); }
      const { error: deleteError } = await supabase.from("media_assets").delete().eq("id", request.params.mediaId);
      if (deleteError) return reply.code(400).send({ error: deleteError.message });

      // Compatibilita V4/V4.2: in alcune modifiche prodotto la foto principale
      // gestita poteva finire anche nel campo image_url. Se coincide con la
      // foto eliminata, rimuoviamo anche quel riferimento per non lasciare
      // <img> rotti nella vetrina.
      if (asset.productId) {
        const { data: product } = await supabase.from("products").select("image_url").eq("id", asset.productId).maybeSingle();
        if (product?.image_url === asset.url) {
          await supabase.from("products").update({ image_url: null, updated_at: new Date().toISOString() }).eq("id", asset.productId);
        }
      }

      if (asset.isPrimary) {
        const column = asset.productId ? "product_id" : "container_id";
        const entityId = asset.productId ?? asset.containerId;
        const { data: next } = await supabase.from("media_assets").select("id").eq(column, entityId).order("position", { ascending: true }).limit(1).maybeSingle();
        if (next) await supabase.from("media_assets").update({ is_primary: true }).eq("id", next.id);
      }
      return reply.code(204).send();
    }

    const db = await readLocalDb();
    const index = db.mediaAssets.findIndex((item) => item.id === request.params.mediaId);
    if (index < 0) return reply.code(404).send({ error: "Foto non trovata" });
    const asset = mapMediaAsset(db.mediaAssets[index]);
    try { await deleteImageFile(asset, null); } catch {}
    db.mediaAssets.splice(index, 1);
    if (asset.productId) {
      const productIndex = db.products.findIndex((item) => item.id === asset.productId);
      if (productIndex >= 0 && db.products[productIndex].imageUrl === asset.url) {
        db.products[productIndex] = {
          ...db.products[productIndex],
          imageUrl: null,
          updatedAt: new Date().toISOString()
        };
      }
    }
    const type: MediaEntityType = asset.productId ? "product" : "container";
    const entityId = asset.productId ?? asset.containerId!;
    const remaining = mediaForEntity(db.mediaAssets, type, entityId);
    if (asset.isPrimary && remaining.length) {
      const nextId = remaining[0].id;
      db.mediaAssets = db.mediaAssets.map((item) => item.id === nextId ? { ...item, isPrimary: true } : item);
    }
    await writeLocalDb(db);
    return reply.code(204).send();
  });
}
