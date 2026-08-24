import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MediaEntityType = "product" | "container";

export type MediaAsset = {
  id: string;
  productId: string | null;
  containerId: string | null;
  storageProvider: "local" | "supabase";
  storagePath: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  isPrimary: boolean;
  createdAt: string;
};

export const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const localUploadsRoot = resolve(process.cwd(), "uploads");

function sanitizeFilename(filename: string) {
  const ext = extname(filename).toLowerCase().slice(0, 10);
  const base = filename.slice(0, Math.max(1, filename.length - ext.length))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "foto";
  return `${base}${ext}`;
}

export function mapMediaAsset(row: any): MediaAsset {
  return {
    id: row.id,
    productId: row.product_id ?? row.productId ?? null,
    containerId: row.container_id ?? row.containerId ?? null,
    storageProvider: row.storage_provider ?? row.storageProvider ?? "local",
    storagePath: row.storage_path ?? row.storagePath ?? "",
    url: row.public_url ?? row.url ?? "",
    originalName: row.original_name ?? row.originalName ?? "foto",
    mimeType: row.mime_type ?? row.mimeType ?? "image/jpeg",
    sizeBytes: Number(row.size_bytes ?? row.sizeBytes ?? 0),
    position: Number(row.position ?? 0),
    isPrimary: Boolean(row.is_primary ?? row.isPrimary),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString()
  };
}

export function entityColumn(type: MediaEntityType) {
  return type === "product" ? "product_id" : "container_id";
}

export function entityLocalKey(type: MediaEntityType) {
  return type === "product" ? "productId" : "containerId";
}

export function mediaForEntity<T extends Record<string, any>>(rows: T[], type: MediaEntityType, id: string) {
  const key = entityLocalKey(type);
  return rows
    .filter((row) => row[key] === id)
    .map(mapMediaAsset)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export async function fetchSupabaseMediaMap(supabase: SupabaseClient, type: MediaEntityType, ids: string[]) {
  const map = new Map<string, MediaAsset[]>();
  if (!ids.length) return map;
  const column = entityColumn(type);
  const { data, error } = await supabase.from("media_assets").select("*").in(column, ids).order("position", { ascending: true });
  if (error) return map;
  for (const row of data ?? []) {
    const id = row[column] as string;
    const list = map.get(id) ?? [];
    list.push(mapMediaAsset(row));
    map.set(id, list);
  }
  return map;
}

export function localMediaMap(rows: Record<string, any>[], type: MediaEntityType, ids: string[]) {
  const map = new Map<string, MediaAsset[]>();
  for (const id of ids) map.set(id, mediaForEntity(rows, type, id));
  return map;
}

export async function saveImageFile(args: {
  type: MediaEntityType;
  entityId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  supabase: SupabaseClient | null;
}) {
  const safeName = sanitizeFilename(args.filename);
  const folder = args.type === "product" ? "products" : "containers";
  const storagePath = `${folder}/${args.entityId}/${randomUUID()}-${safeName}`;

  if (args.supabase) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "container-images";
    const { error } = await args.supabase.storage.from(bucket).upload(storagePath, args.buffer, {
      contentType: args.mimeType,
      upsert: false,
      cacheControl: "3600"
    });
    if (error) throw new Error(`Upload Supabase Storage non riuscito: ${error.message}`);
    const { data } = args.supabase.storage.from(bucket).getPublicUrl(storagePath);
    return { storageProvider: "supabase" as const, storagePath, publicUrl: data.publicUrl };
  }

  const diskPath = resolve(localUploadsRoot, storagePath);
  await mkdir(dirname(diskPath), { recursive: true });
  await writeFile(diskPath, args.buffer);
  const baseUrl = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4001}`).replace(/\/$/, "");
  return { storageProvider: "local" as const, storagePath, publicUrl: `${baseUrl}/uploads/${storagePath}` };
}

export async function deleteImageFile(asset: MediaAsset, supabase: SupabaseClient | null) {
  if (asset.storageProvider === "supabase" && supabase) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "container-images";
    const { error } = await supabase.storage.from(bucket).remove([asset.storagePath]);
    if (error) throw new Error(`Eliminazione Storage non riuscita: ${error.message}`);
    return;
  }
  if (asset.storageProvider === "local") {
    try { await unlink(resolve(localUploadsRoot, asset.storagePath)); } catch {}
  }
}
