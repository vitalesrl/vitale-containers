import type {
  ContainerUnit,
  EbayListing,
  EbayPublishPayload,
  EbayResources,
  EbaySettings,
  EbayStatus,
  Lead,
  LeadStatus,
  MediaAsset,
  Product
} from "./types";
import { getSupabaseBrowserClient } from "./supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export type ProductPayload = Omit<Product, "id" | "images" | "createdAt" | "updatedAt">;
export type ContainerPayload = Omit<ContainerUnit, "id" | "productTitle" | "images" | "createdAt" | "updatedAt">;
export type MediaEntityType = "product" | "container";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();

  // Fastify rifiuta con HTTP 400 una richiesta dichiarata application/json
  // quando il body è assente (caso tipico dei DELETE). Aggiungiamo quindi
  // Content-Type solo quando stiamo realmente inviando un body JSON.
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined && init?.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store"
    });
  } catch {
    throw new Error(`Backend non raggiungibile su ${API_URL}. Verifica che il server sulla porta 4001 sia attivo.`);
  }
  if (!response.ok) {
    let message = `Errore ${response.status}`;
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function uploadMedia(type: MediaEntityType, id: string, files: File[]) {
  const body = new FormData();
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  files.forEach((file) => body.append("files", file));
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/admin/media/${type}/${id}`, { method: "POST", body, headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined });
  } catch {
    throw new Error(`Backend non raggiungibile su ${API_URL}. Verifica che il server sulla porta 4001 sia attivo.`);
  }
  if (!response.ok) {
    let message = `Errore ${response.status}`;
    try { const data = await response.json(); message = data.error || message; } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<MediaAsset[]>;
}

export const adminApi = {
  products: {
    list: () => request<Product[]>("/api/admin/products"),
    create: (payload: ProductPayload) => request<Product>("/api/admin/products", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: ProductPayload) => request<Product>(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id: string) => request<void>(`/api/admin/products/${id}`, { method: "DELETE" })
  },
  containers: {
    list: () => request<ContainerUnit[]>("/api/admin/containers"),
    create: (payload: ContainerPayload) => request<ContainerUnit>("/api/admin/containers", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: ContainerPayload) => request<ContainerUnit>(`/api/admin/containers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id: string) => request<void>(`/api/admin/containers/${id}`, { method: "DELETE" })
  },
  leads: {
    list: () => request<Lead[]>("/api/admin/leads"),
    setStatus: (id: string, status: LeadStatus) => request<Lead>(`/api/admin/leads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    remove: (id: string) => request<void>(`/api/admin/leads/${id}`, { method: "DELETE" })
  },
  media: {
    list: (type: MediaEntityType, id: string) => request<MediaAsset[]>(`/api/admin/media/${type}/${id}`),
    upload: uploadMedia,
    setPrimary: (mediaId: string) => request<MediaAsset>(`/api/admin/media/${mediaId}/primary`, { method: "PATCH", body: "{}" }),
    reorder: (type: MediaEntityType, id: string, ids: string[]) => request<MediaAsset[]>(`/api/admin/media/${type}/${id}/order`, { method: "PUT", body: JSON.stringify({ ids }) }),
    remove: (mediaId: string) => request<void>(`/api/admin/media/${mediaId}`, { method: "DELETE" })
  },
  ebay: {
    status: () => request<EbayStatus>("/api/admin/ebay/status"),
    connect: () => request<{ authorizationUrl: string }>("/api/admin/ebay/connect", { method: "POST" }),
    disconnect: () => request<void>("/api/admin/ebay/connection", { method: "DELETE" }),
    resources: () => request<EbayResources>("/api/admin/ebay/resources"),
    saveSettings: (payload: Omit<EbaySettings, "environment" | "updatedAt">) =>
      request<EbaySettings>("/api/admin/ebay/settings", { method: "PUT", body: JSON.stringify(payload) }),
    listings: () => request<EbayListing[]>("/api/admin/ebay/listings"),
    publish: (productId: string, payload: EbayPublishPayload) =>
      request<EbayListing>(`/api/admin/ebay/listings/${productId}/publish`, { method: "POST", body: JSON.stringify(payload) }),
    withdraw: (productId: string) =>
      request<EbayListing>(`/api/admin/ebay/listings/${productId}/withdraw`, { method: "POST" })
  }
};
