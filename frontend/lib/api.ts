import { demoProducts } from "./demo";
import type { AdminStats, Product } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

const PUBLIC_FETCH_TIMEOUT_MS = 3000;
const PUBLIC_REVALIDATE_SECONDS = 300;

async function publicApiFetch<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PUBLIC_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${API_URL}${path}`, {
      signal: controller.signal,
      next: {
        revalidate: PUBLIC_REVALIDATE_SECONDS
      }
    });

    if (!response.ok) return null;

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function liveApiFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      cache: "no-store"
    });

    if (!response.ok) return null;

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getProducts(): Promise<Product[]> {
  return (
    (await publicApiFetch<Product[]>("/api/products")) ??
    demoProducts
  );
}

export async function getProduct(
  slug: string
): Promise<Product | null> {
  const product = await publicApiFetch<Product>(
    `/api/products/${slug}`
  );

  return (
    product ??
    demoProducts.find((item) => item.slug === slug) ??
    null
  );
}

export async function getAdminStats(): Promise<AdminStats> {
  return (
    (await liveApiFetch<AdminStats>("/api/admin/stats")) ?? {
      products: demoProducts.length,
      availableUnits: null,
      reservedUnits: 0,
      leads: 0,
      activeListings: demoProducts.length
    }
  );
}
