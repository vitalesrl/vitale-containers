import type { Lead, LeadStatus, MediaAsset, Product } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export type ProductPayload = Omit<Product, "id" | "images" | "createdAt" | "updatedAt">;
export type MediaEntityType = "product";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

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
  files.forEach((file) => body.append("files", file));
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/admin/media/${type}/${id}`, { method: "POST", body });
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
  }
};
