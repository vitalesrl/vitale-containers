import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  EbayApiError,
  EbayConfigurationError,
  disconnectEbay,
  ebayFrontendUrl,
  ebayRequest,
  exchangeEbayAuthorizationCode,
  getEbayAuthorizationUrl,
  getEbayConnectionStatus,
  getEbayEnvironment,
  verifyEbayOAuthState
} from "../lib/ebay.js";
import { getSupabaseAdmin } from "../lib/supabase.js";

const settingsSchema = z.object({
  marketplaceId: z.literal("EBAY_IT").default("EBAY_IT"),
  merchantLocationKey: z.string().trim().min(1).max(36),
  fulfillmentPolicyId: z.string().trim().min(1).max(100),
  paymentPolicyId: z.string().trim().min(1).max(100),
  returnPolicyId: z.string().trim().min(1).max(100),
  currency: z.literal("EUR").default("EUR")
});

const publishSchema = z.object({
  categoryId: z.string().trim().min(1).max(20),
  condition: z.enum([
    "NEW",
    "LIKE_NEW",
    "NEW_OTHER",
    "NEW_WITH_DEFECTS",
    "CERTIFIED_REFURBISHED",
    "EXCELLENT_REFURBISHED",
    "VERY_GOOD_REFURBISHED",
    "GOOD_REFURBISHED",
    "USED_EXCELLENT",
    "USED_VERY_GOOD",
    "USED_GOOD",
    "USED_ACCEPTABLE",
    "FOR_PARTS_OR_NOT_WORKING"
  ]).default("USED_GOOD"),
  price: z.number().finite().positive().optional(),
  quantity: z.number().int().positive().optional(),
  brand: z.string().trim().min(1).max(65).default("Senza marca"),
  aspects: z.record(z.string(), z.array(z.string().trim().min(1).max(50))).optional()
});

type EbaySettings = z.infer<typeof settingsSchema>;

type EbayOfferResponse = {
  offerId: string;
  warnings?: unknown[];
};

type EbayPublishResponse = {
  listingId: string;
  warnings?: unknown[];
};

function supabaseOrThrow() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new EbayConfigurationError("Supabase non configurato sul server.");
  }
  return supabase;
}

function sendEbayError(reply: FastifyReply, error: unknown) {
  if (error instanceof EbayApiError) {
    return reply.code(error.status >= 400 && error.status < 600 ? error.status : 502).send({
      error: error.message,
      details: error.details
    });
  }
  if (error instanceof EbayConfigurationError) {
    return reply.code(503).send({ error: error.message });
  }
  const message = error instanceof Error ? error.message : "Operazione eBay non riuscita.";
  return reply.code(500).send({ error: message });
}

async function readSettings() {
  const environment = getEbayEnvironment();
  const { data, error } = await supabaseOrThrow()
    .from("ebay_settings")
    .select("*")
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw new EbayConfigurationError(error.message);
  if (!data) return null;
  return {
    environment,
    marketplaceId: data.marketplace_id,
    merchantLocationKey: data.merchant_location_key,
    fulfillmentPolicyId: data.fulfillment_policy_id,
    paymentPolicyId: data.payment_policy_id,
    returnPolicyId: data.return_policy_id,
    currency: data.currency,
    updatedAt: data.updated_at
  };
}

async function saveSettings(settings: EbaySettings) {
  const environment = getEbayEnvironment();
  const now = new Date().toISOString();
  const { error } = await supabaseOrThrow().from("ebay_settings").upsert({
    environment,
    marketplace_id: settings.marketplaceId,
    merchant_location_key: settings.merchantLocationKey,
    fulfillment_policy_id: settings.fulfillmentPolicyId,
    payment_policy_id: settings.paymentPolicyId,
    return_policy_id: settings.returnPolicyId,
    currency: settings.currency,
    updated_at: now
  }, { onConflict: "environment" });
  if (error) throw new EbayConfigurationError(error.message);
  return { environment, ...settings, updatedAt: now };
}

function listingUrl(listingId: string) {
  return getEbayEnvironment() === "production"
    ? `https://www.ebay.it/itm/${listingId}`
    : `https://www.sandbox.ebay.com/itm/${listingId}`;
}

function skuFor(productId: string) {
  return `VITALE${productId.replace(/[^a-z0-9]/gi, "").slice(0, 24).toUpperCase()}`;
}

function plainText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, maxLength);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function listingPayload(row: any) {
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.products?.title ?? null,
    marketplace: row.marketplace,
    environment: row.marketplace_environment,
    sku: row.sku,
    offerId: row.external_offer_id,
    listingId: row.external_listing_id,
    externalUrl: row.external_url,
    categoryId: row.category_id,
    title: row.title,
    price: numberOrNull(row.price),
    status: row.status,
    syncStatus: row.sync_status,
    lastError: row.last_error,
    metadata: row.metadata ?? {},
    publishedAt: row.published_at,
    updatedAt: row.updated_at
  };
}

async function upsertListing(productId: string, values: Record<string, unknown>) {
  const environment = getEbayEnvironment();
  const { data, error } = await supabaseOrThrow()
    .from("marketplace_listings")
    .upsert({
      product_id: productId,
      marketplace: "ebay",
      marketplace_environment: environment,
      updated_at: new Date().toISOString(),
      ...values
    }, { onConflict: "product_id,marketplace,marketplace_environment" })
    .select("*, products(title)")
    .single();
  if (error) throw new EbayConfigurationError(error.message);
  return listingPayload(data);
}

async function existingListing(productId: string) {
  const { data, error } = await supabaseOrThrow()
    .from("marketplace_listings")
    .select("*")
    .eq("product_id", productId)
    .eq("marketplace", "ebay")
    .eq("marketplace_environment", getEbayEnvironment())
    .maybeSingle();
  if (error) throw new EbayConfigurationError(error.message);
  return data;
}

async function productForEbay(productId: string) {
  const supabase = supabaseOrThrow();
  const [{ data: product, error: productError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase
      .from("media_assets")
      .select("public_url, position, is_primary")
      .eq("product_id", productId)
      .order("position", { ascending: true })
  ]);
  if (productError) throw new EbayConfigurationError(productError.message);
  if (mediaError) throw new EbayConfigurationError(mediaError.message);
  if (!product) throw new EbayConfigurationError("Prodotto non trovato.");
  const imageUrls = (media ?? [])
    .map((item) => item.public_url)
    .filter((url): url is string => typeof url === "string" && url.startsWith("https://"));
  if (typeof product.image_url === "string" && product.image_url.startsWith("https://")) {
    imageUrls.push(product.image_url);
  }
  return { product, imageUrls: Array.from(new Set(imageUrls)).slice(0, 24) };
}

export async function ebayRoutes(app: FastifyInstance) {
  app.get("/api/admin/ebay/status", async (_request, reply) => {
    try {
      const connection = await getEbayConnectionStatus();
      let settings = null;
      if (connection.databaseReady) settings = await readSettings();
      return { ...connection, settings };
    } catch (error) {
      return sendEbayError(reply, error);
    }
  });

  app.post("/api/admin/ebay/connect", async (_request, reply) => {
    try {
      const status = await getEbayConnectionStatus();
      if (!status.databaseReady) {
        return reply.code(503).send({
          error: "Esegui database/ebay-sell.sql su Supabase prima di collegare eBay."
        });
      }
      return { authorizationUrl: getEbayAuthorizationUrl() };
    } catch (error) {
      return sendEbayError(reply, error);
    }
  });

  app.delete("/api/admin/ebay/connection", async (_request, reply) => {
    try {
      await disconnectEbay();
      return reply.code(204).send();
    } catch (error) {
      return sendEbayError(reply, error);
    }
  });

  app.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>("/api/ebay/oauth/callback", async (request, reply) => {
    const redirect = new URL(ebayFrontendUrl());
    try {
      if (request.query.error) {
        throw new EbayConfigurationError(
          request.query.error_description || "Autorizzazione eBay rifiutata."
        );
      }
      if (!request.query.code || !request.query.state) {
        throw new EbayConfigurationError("Risposta OAuth eBay incompleta.");
      }
      if (!verifyEbayOAuthState(request.query.state)) {
        throw new EbayConfigurationError("Stato OAuth eBay non valido o scaduto.");
      }
      await exchangeEbayAuthorizationCode(request.query.code);
      redirect.searchParams.set("ebay", "connected");
    } catch (error) {
      redirect.searchParams.set("ebay", "error");
      redirect.searchParams.set(
        "message",
        error instanceof Error ? error.message : "Connessione eBay non riuscita."
      );
    }
    return reply.redirect(redirect.toString());
  });

  app.get("/api/admin/ebay/resources", async (_request, reply) => {
    try {
      const marketplaceId = "EBAY_IT";
      const [fulfillment, payment, returns, locations] = await Promise.all([
        ebayRequest<{ fulfillmentPolicies?: unknown[] }>(
          `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`
        ),
        ebayRequest<{ paymentPolicies?: unknown[] }>(
          `/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`
        ),
        ebayRequest<{ returnPolicies?: unknown[] }>(
          `/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`
        ),
        ebayRequest<{ locations?: unknown[] }>(
          "/sell/inventory/v1/location?limit=100"
        )
      ]);
      return {
        fulfillmentPolicies: fulfillment.fulfillmentPolicies ?? [],
        paymentPolicies: payment.paymentPolicies ?? [],
        returnPolicies: returns.returnPolicies ?? [],
        locations: locations.locations ?? []
      };
    } catch (error) {
      return sendEbayError(reply, error);
    }
  });

  app.put("/api/admin/ebay/settings", async (request, reply) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Configurazione eBay non valida.",
        details: parsed.error.flatten()
      });
    }
    try {
      return await saveSettings(parsed.data);
    } catch (error) {
      return sendEbayError(reply, error);
    }
  });

  app.get("/api/admin/ebay/listings", async (_request, reply) => {
    try {
      const { data, error } = await supabaseOrThrow()
        .from("marketplace_listings")
        .select("*, products(title)")
        .eq("marketplace", "ebay")
        .eq("marketplace_environment", getEbayEnvironment())
        .order("updated_at", { ascending: false });
      if (error) throw new EbayConfigurationError(error.message);
      return (data ?? []).map(listingPayload);
    } catch (error) {
      return sendEbayError(reply, error);
    }
  });

  app.post<{ Params: { productId: string } }>(
    "/api/admin/ebay/listings/:productId/publish",
    async (request, reply) => {
      const parsed = publishSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Dati annuncio eBay non validi.",
          details: parsed.error.flatten()
        });
      }

      const productId = request.params.productId;
      try {
        const settings = await readSettings();
        if (!settings) {
          return reply.code(400).send({
            error: "Seleziona e salva prima sede e policy eBay."
          });
        }
        const { product, imageUrls } = await productForEbay(productId);
        const price = parsed.data.price ?? numberOrNull(product.price);
        const quantity = parsed.data.quantity ?? numberOrNull(product.availability);
        if (!price || price <= 0) {
          return reply.code(400).send({ error: "Inserisci un prezzo maggiore di zero." });
        }
        if (!quantity || quantity < 1) {
          return reply.code(400).send({ error: "Inserisci una disponibilità di almeno 1 unità." });
        }
        if (imageUrls.length === 0) {
          return reply.code(400).send({
            error: "L'annuncio eBay richiede almeno una fotografia pubblica HTTPS."
          });
        }

        const sku = skuFor(productId);
        const productTitle = plainText(product.title, 80);
        const productDescription = plainText(product.description, 4000);
        if (!productTitle || !productDescription) {
          return reply.code(400).send({
            error: "L'annuncio eBay richiede titolo e descrizione del prodotto."
          });
        }
        const baseAspects: Record<string, string[]> = {
          Marca: [parsed.data.brand],
          Tipologia: [plainText(product.type, 50) || "Container"],
          Dimensione: [plainText(product.size, 50) || "Non specificata"]
        };
        const inventoryBody = {
          availability: {
            shipToLocationAvailability: { quantity }
          },
          condition: parsed.data.condition,
          ...(parsed.data.condition.startsWith("USED")
            ? { conditionDescription: plainText(product.condition, 1000) }
            : {}),
          product: {
            title: productTitle,
            description: productDescription,
            imageUrls,
            brand: parsed.data.brand,
            aspects: { ...baseAspects, ...(parsed.data.aspects ?? {}) }
          }
        };

        await ebayRequest(
          `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
          {
            method: "PUT",
            headers: { "Content-Language": "it-IT" },
            body: JSON.stringify(inventoryBody)
          }
        );

        const offerBody = {
          sku,
          marketplaceId: settings.marketplaceId,
          format: "FIXED_PRICE",
          listingDuration: "GTC",
          availableQuantity: quantity,
          categoryId: parsed.data.categoryId,
          merchantLocationKey: settings.merchantLocationKey,
          listingDescription: productDescription,
          includeCatalogProductDetails: false,
          listingPolicies: {
            fulfillmentPolicyId: settings.fulfillmentPolicyId,
            paymentPolicyId: settings.paymentPolicyId,
            returnPolicyId: settings.returnPolicyId
          },
          pricingSummary: {
            price: {
              value: price.toFixed(2),
              currency: settings.currency
            }
          }
        };

        const existing = await existingListing(productId);
        let offerId = existing?.external_offer_id as string | null;
        let listingId = existing?.external_listing_id as string | null;
        let warnings: unknown[] = [];

        if (offerId) {
          await ebayRequest(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
            method: "PUT",
            headers: { "Content-Language": "it-IT" },
            body: JSON.stringify(offerBody)
          });
        } else {
          const created = await ebayRequest<EbayOfferResponse>(
            "/sell/inventory/v1/offer",
            {
              method: "POST",
              headers: { "Content-Language": "it-IT" },
              body: JSON.stringify(offerBody)
            }
          );
          offerId = created.offerId;
          warnings = created.warnings ?? [];
        }

        if (!offerId) throw new EbayConfigurationError("eBay non ha restituito l'ID offerta.");

        // Salviamo l'offerta prima della pubblicazione: in caso di errore eBay
        // l'operatore può correggerla e riprovare senza creare duplicati.
        await upsertListing(productId, {
          sku,
          external_offer_id: offerId,
          external_listing_id: listingId,
          external_url: listingId ? listingUrl(listingId) : null,
          category_id: parsed.data.categoryId,
          title: productTitle,
          description: productDescription,
          price,
          status: listingId && existing?.status === "active" ? "active" : "draft",
          sync_status: "pending",
          last_error: null,
          published_at: existing?.published_at ?? null,
          metadata: {
            condition: parsed.data.condition,
            quantity,
            brand: parsed.data.brand,
            warnings
          }
        });

        if (!listingId || existing?.status !== "active") {
          const published = await ebayRequest<EbayPublishResponse>(
            `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
            { method: "POST" }
          );
          listingId = published.listingId;
          warnings = [...warnings, ...(published.warnings ?? [])];
        }

        if (!listingId) throw new EbayConfigurationError("eBay non ha restituito l'ID annuncio.");

        return await upsertListing(productId, {
          sku,
          external_offer_id: offerId,
          external_listing_id: listingId,
          external_url: listingUrl(listingId),
          category_id: parsed.data.categoryId,
          title: productTitle,
          description: productDescription,
          price,
          status: "active",
          sync_status: "synced",
          last_error: null,
          published_at: existing?.published_at ?? new Date().toISOString(),
          metadata: {
            condition: parsed.data.condition,
            quantity,
            brand: parsed.data.brand,
            warnings
          }
        });
      } catch (error) {
        try {
          await upsertListing(productId, {
            status: "error",
            sync_status: "error",
            last_error: error instanceof Error ? error.message : "Errore eBay"
          });
        } catch {
          // Se lo schema non è pronto, viene restituito l'errore originale.
        }
        return sendEbayError(reply, error);
      }
    }
  );

  app.post<{ Params: { productId: string } }>(
    "/api/admin/ebay/listings/:productId/withdraw",
    async (request, reply) => {
      try {
        const listing = await existingListing(request.params.productId);
        if (!listing?.external_offer_id) {
          return reply.code(404).send({ error: "Offerta eBay non trovata." });
        }
        await ebayRequest(
          `/sell/inventory/v1/offer/${encodeURIComponent(listing.external_offer_id)}/withdraw`,
          { method: "POST" }
        );
        return await upsertListing(request.params.productId, {
          status: "paused",
          sync_status: "synced",
          last_error: null
        });
      } catch (error) {
        return sendEbayError(reply, error);
      }
    }
  );
}
