import { demoProducts } from "./demo";
import type { AdminStats, Product } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getProducts(): Promise<Product[]> {
  return (await apiFetch<Product[]>("/api/products")) ?? demoProducts;
}

export async function getProduct(slug: string): Promise<Product | null> {
  const product = await apiFetch<Product>(`/api/products/${slug}`);
  return product ?? demoProducts.find((item) => item.slug === slug) ?? null;
}

export async function getAdminStats(): Promise<AdminStats> {
  return (
    (await apiFetch<AdminStats>("/api/admin/stats")) ?? {
      products: demoProducts.length,
      availableUnits: null,
      reservedUnits: 0,
      leads: 0,
      activeListings: demoProducts.length
    }
  );
}
