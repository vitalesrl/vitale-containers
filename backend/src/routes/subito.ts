import archiver from "archiver";
import type { FastifyInstance, FastifyReply } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import {
  getSubitoAdapter,
  getSubitoAdapterMode
} from "../lib/subito.js";
import { getSupabaseAdmin } from "../lib/supabase.js";

const publishedSchema = z.object({
  listingUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  listingId: z.string().trim().max(120).optional().or(z.literal(""))
});

type SubitoPhoto = {
  url: string;
  mimeType: string;
};

class SubitoConfigurationError extends Error {}

function supabaseOrThrow() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new SubitoConfigurationError("Supabase non configurato sul server.");
  }
  return supabase;
}

function sendSubitoError(reply: FastifyReply, error: unknown) {
  if (error instanceof SubitoConfigurationError) {
    return reply.code(503).send({ error: error.message });
  }
  return reply.code(500).send({
    error: error instanceof Error ? error.message : "Operazione Subito non riuscita."
  });
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function listingPayload(row: any) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.products?.title ?? null,
    adapterMode: row.adapter_mode ?? "manual",
    subitoStatus: row.status,
    subitoListingUrl: row.external_url,
    subitoListingId: row.external_listing_id,
    subitoPublishedAt: row.published_at,
    subitoLastSync: row.last_sync_at,
    title: row.title,
    description: row.description,
    price: numberOrNull(row.price),
    location: metadata.location ?? "Salerno",
    photoCount: Array.isArray(metadata.photo_urls) ? metadata.photo_urls.length : 0,
    lastError: row.last_error,
    updatedAt: row.updated_at
  };
}

async function productForSubito(productId: string) {
  const supabase = supabaseOrThrow();
  const [{ data: product, error: productError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase
      .from("media_assets")
      .select("public_url, mime_type, position, is_primary")
      .eq("product_id", productId)
      .order("position", { ascending: true })
  ]);
  if (productError) throw new SubitoConfigurationError(productError.message);
  if (mediaError) throw new SubitoConfigurationError(mediaError.message);
  if (!product) throw new SubitoConfigurationError("Prodotto non trovato.");

  const photos: SubitoPhoto[] = (media ?? [])
    .filter((item) => typeof item.public_url === "string" && item.public_url.startsWith("https://"))
    .map((item) => ({
      url: item.public_url,
      mimeType: typeof item.mime_type === "string" ? item.mime_type : ""
    }));
  if (typeof product.image_url === "string" && product.image_url.startsWith("https://")) {
    photos.push({ url: product.image_url, mimeType: "" });
  }

  const uniquePhotos = Array.from(
    new Map(photos.map((photo) => [photo.url, photo])).values()
  ).slice(0, 30);
  return { product, photos: uniquePhotos };
}

async function existingListing(productId: string) {
  const { data, error } = await supabaseOrThrow()
    .from("marketplace_listings")
    .select("*")
    .eq("product_id", productId)
    .eq("marketplace", "subito")
    .eq("marketplace_environment", "production")
    .maybeSingle();
  if (error) throw new SubitoConfigurationError(error.message);
  return data;
}

async function upsertListing(productId: string, values: Record<string, unknown>) {
  const { data, error } = await supabaseOrThrow()
    .from("marketplace_listings")
    .upsert({
      product_id: productId,
      marketplace: "subito",
      marketplace_environment: "production",
      adapter_mode: "manual",
      updated_at: new Date().toISOString(),
      ...values
    }, { onConflict: "product_id,marketplace,marketplace_environment" })
    .select("*, products(title)")
    .single();
  if (error) throw new SubitoConfigurationError(error.message);
  return listingPayload(data);
}

function subitoListingId(url: string) {
  const match = url.match(/-(\d+)\.htm(?:[?#].*)?$/i);
  return match?.[1] ?? null;
}

function safeFilename(value: unknown) {
  const filename = String(value ?? "foto-subito")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return filename.slice(0, 60) || "foto-subito";
}

async function readyPhoto(photo: SubitoPhoto) {
  const response = await fetch(photo.url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Foto non raggiungibile (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 20 * 1024 * 1024) throw new Error("Foto troppo grande.");
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length > 20 * 1024 * 1024) throw new Error("Foto troppo grande.");
  const mimeType = (response.headers.get("content-type") || photo.mimeType).split(";")[0].toLowerCase();
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return { content: source, extension: "jpg" };
  }
  if (mimeType === "image/png") {
    return { content: source, extension: "png" };
  }
  if (mimeType === "image/gif") {
    return { content: source, extension: "gif" };
  }
  return {
    content: await sharp(source).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
    extension: "jpg"
  };
}

export async function subitoRoutes(app: FastifyInstance) {
  app.get("/api/admin/subito/status", async (_request, reply) => {
    const status = {
      mode: getSubitoAdapterMode(),
      adapterAvailable: getSubitoAdapterMode() === "manual",
      databaseReady: false
    };
    try {
      const { error } = await supabaseOrThrow()
        .from("marketplace_listings")
        .select("adapter_mode,last_sync_at")
        .limit(1);
      status.databaseReady = !error;
      return status;
    } catch {
      return status;
    }
  });

  app.get("/api/admin/subito/listings", async (_request, reply) => {
    try {
      const { data, error } = await supabaseOrThrow()
        .from("marketplace_listings")
        .select("*, products(title)")
        .eq("marketplace", "subito")
        .eq("marketplace_environment", "production")
        .order("updated_at", { ascending: false });
      if (error) throw new SubitoConfigurationError(error.message);
      return (data ?? []).map(listingPayload);
    } catch (error) {
      return sendSubitoError(reply, error);
    }
  });

  app.post<{ Params: { productId: string } }>(
    "/api/admin/subito/listings/:productId/prepare",
    async (request, reply) => {
      try {
        const { product, photos } = await productForSubito(request.params.productId);
        const prepared = getSubitoAdapter().prepare(
          product,
          photos.map((photo) => photo.url)
        );
        const now = new Date().toISOString();
        const existing = await existingListing(request.params.productId);
        return await upsertListing(request.params.productId, {
          title: prepared.title,
          description: prepared.description,
          price: prepared.price,
          status: existing?.status === "active" ? "active" : "draft",
          external_url: existing?.external_url ?? null,
          external_listing_id: existing?.external_listing_id ?? null,
          published_at: existing?.published_at ?? null,
          last_sync_at: now,
          last_error: null,
          metadata: {
            ...(existing?.metadata ?? {}),
            location: prepared.location,
            photo_urls: prepared.photoUrls,
            subito_status: existing?.status === "active" ? "active" : "draft",
            subito_listing_url: existing?.external_url ?? null,
            subito_listing_id: existing?.external_listing_id ?? null,
            subito_published_at: existing?.published_at ?? null,
            subito_last_sync: now
          }
        });
      } catch (error) {
        return sendSubitoError(reply, error);
      }
    }
  );

  app.patch<{ Params: { productId: string } }>(
    "/api/admin/subito/listings/:productId/published",
    async (request, reply) => {
      const parsed = publishedSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "URL o ID annuncio Subito non validi." });
      }
      try {
        const existing = await existingListing(request.params.productId);
        if (!existing) {
          return reply.code(404).send({ error: "Prepara prima l'annuncio Subito." });
        }
        const listingUrl = parsed.data.listingUrl || existing.external_url || null;
        if (listingUrl) {
          const hostname = new URL(listingUrl).hostname.toLowerCase();
          if (hostname !== "subito.it" && !hostname.endsWith(".subito.it")) {
            return reply.code(400).send({ error: "Inserisci un URL appartenente a subito.it." });
          }
        }
        const listingId = parsed.data.listingId
          || (listingUrl ? subitoListingId(listingUrl) : null)
          || existing.external_listing_id
          || null;
        const now = new Date().toISOString();
        const publishedAt = existing.published_at ?? now;
        return await upsertListing(request.params.productId, {
          status: "active",
          external_url: listingUrl,
          external_listing_id: listingId,
          published_at: publishedAt,
          last_sync_at: now,
          last_error: null,
          metadata: {
            ...(existing.metadata ?? {}),
            subito_status: "active",
            subito_listing_url: listingUrl,
            subito_listing_id: listingId,
            subito_published_at: publishedAt,
            subito_last_sync: now
          }
        });
      } catch (error) {
        return sendSubitoError(reply, error);
      }
    }
  );

  app.get<{ Params: { productId: string } }>(
    "/api/admin/subito/listings/:productId/photos",
    async (request, reply) => {
      try {
        const { product, photos } = await productForSubito(request.params.productId);
        if (photos.length === 0) {
          return reply.code(404).send({ error: "Il prodotto non contiene fotografie pubbliche." });
        }

        const filename = `${safeFilename(product.title)}-subito.zip`;
        reply.hijack();
        reply.raw.statusCode = 200;
        reply.raw.setHeader("Content-Type", "application/zip");
        reply.raw.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        reply.raw.setHeader("Cache-Control", "no-store");

        const archive = archiver("zip", { zlib: { level: 9 } });
        let index = 0;
        let appended = 0;
        let advancing = false;

        archive.on("error", (archiveError) => reply.raw.destroy(archiveError));
        archive.pipe(reply.raw);

        async function appendNext() {
          if (advancing) return;
          advancing = true;
          try {
            while (index < photos.length) {
              const photo = photos[index++];
              try {
                const ready = await readyPhoto(photo);
                appended += 1;
                archive.append(ready.content, {
                  name: `foto-${String(appended).padStart(2, "0")}.${ready.extension}`
                });
                return;
              } catch {
                // Una foto non raggiungibile non interrompe il download delle altre.
              }
            }
            if (appended === 0) {
              archive.append(
                "Nessuna fotografia è risultata scaricabile. Verificare gli URL nel prodotto.",
                { name: "LEGGIMI.txt" }
              );
              appended += 1;
              return;
            }
            await archive.finalize();
          } catch (streamError) {
            archive.abort();
            reply.raw.destroy(
              streamError instanceof Error ? streamError : new Error("Creazione archivio foto non riuscita.")
            );
          } finally {
            advancing = false;
          }
        }

        archive.on("entry", () => void appendNext());
        await appendNext();
        return reply;
      } catch (error) {
        if (reply.sent) return reply;
        return sendSubitoError(reply, error);
      }
    }
  );
}
