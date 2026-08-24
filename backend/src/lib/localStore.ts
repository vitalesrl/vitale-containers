import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demoProducts } from "../data/demo.js";
import type { MediaAsset } from "./media.js";

export type LocalProduct = (typeof demoProducts)[number] & {
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LocalContainer = {
  id: string;
  productId: string | null;
  containerNumber: string;
  status: "available" | "reserved" | "sold" | "incoming" | "unavailable";
  year: number | null;
  manufacturer: string;
  color: string;
  tareKg: number | null;
  cscExpiry: string | null;
  purchasePrice: number | null;
  salePrice: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalLead = {
  id: string;
  productId: string | null;
  name: string;
  company: string;
  vatNumber: string;
  email: string;
  phone: string;
  destination: string;
  quantity: number;
  transportRequired: boolean;
  message: string;
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  createdAt: string;
};

export type LocalDb = {
  products: LocalProduct[];
  containers: LocalContainer[];
  leads: LocalLead[];
  mediaAssets: MediaAsset[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "../../data/local-db.json");

function freshDb(): LocalDb {
  const now = new Date().toISOString();
  return {
    products: demoProducts.map((product) => ({ ...product, isPublished: true, createdAt: now, updatedAt: now })),
    containers: [],
    leads: [],
    mediaAssets: []
  };
}

async function ensureDb() {
  await mkdir(dirname(dbPath), { recursive: true });
  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeFile(dbPath, JSON.stringify(freshDb(), null, 2), "utf8");
  }
}

function normalizeDb(value: Partial<LocalDb>): LocalDb {
  const fallback = freshDb();
  return {
    products: Array.isArray(value.products) ? value.products : fallback.products,
    containers: Array.isArray(value.containers) ? value.containers : [],
    leads: Array.isArray(value.leads) ? value.leads : [],
    mediaAssets: Array.isArray(value.mediaAssets) ? value.mediaAssets : []
  };
}

function repairLegacyManagedImageReferences(db: LocalDb) {
  let changed = false;
  const products = db.products.map((product) => {
    const url = product.imageUrl;
    if (typeof url !== "string" || !url.includes("/uploads/products/")) return product;
    const stillExists = db.mediaAssets.some((asset) => asset.productId === product.id && asset.url === url);
    if (stillExists) return product;
    changed = true;
    return { ...product, imageUrl: null, updatedAt: new Date().toISOString() };
  });
  return { db: changed ? { ...db, products } : db, changed };
}

export async function readLocalDb(): Promise<LocalDb> {
  await ensureDb();
  try {
    const parsed = normalizeDb(JSON.parse(await readFile(dbPath, "utf8")) as Partial<LocalDb>);
    const repaired = repairLegacyManagedImageReferences(parsed);
    if (repaired.changed) await writeLocalDb(repaired.db);
    return repaired.db;
  } catch {
    const reset = freshDb();
    await writeLocalDb(reset);
    return reset;
  }
}

export async function writeLocalDb(db: LocalDb) {
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

export function newId() {
  return randomUUID();
}
