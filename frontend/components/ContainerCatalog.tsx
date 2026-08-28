"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { waitForBackendReady } from "@/lib/backendReady";
import type { Product } from "@/lib/types";

type FilterKey = "all" | "20" | "40" | "40hc" | "45hc-pw" | "reefer" | "open-top" | "office";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tutti" },
  { key: "20", label: "20 piedi" },
  { key: "40", label: "40 piedi" },
  { key: "40hc", label: "40' High Cube" },
  { key: "45hc-pw", label: "45' HC Pallet Wide" },
  { key: "reefer", label: "Reefer" },
  { key: "open-top", label: "Open Top" },
  { key: "office", label: "Uso ufficio" }
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

function normalizeSize(value: string) {
  const normalized = (value || "").toLowerCase().replace(/\s+/g, "").replace(/[’′]/g, "'");
  if (normalized.startsWith("45")) return "45hc";
  if (normalized.includes("40hc") || normalized.includes("40'hc") || normalized.includes("highcube")) return "40hc";
  if (normalized.startsWith("40")) return "40";
  if (normalized.startsWith("20")) return "20";
  return normalized;
}

function normalizeType(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[’′]/g, "'")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesFilter(product: Product, filter: FilterKey) {
  if (filter === "all") return true;

  const size = normalizeSize(product.size);
  const type = normalizeType(product.type);
  const searchableText = normalizeType(`${product.title} ${product.type} ${product.size}`);

  if (filter === "20") return size === "20";
  if (filter === "40") return size === "40";
  if (filter === "40hc") return size === "40hc";
  if (filter === "45hc-pw") return size === "45hc" || searchableText.includes("pallet wide");
  if (filter === "reefer") {
    return searchableText.includes("reefer")
      || searchableText.includes("refrigerat")
      || searchableText.includes("frigorifer");
  }
  if (filter === "open-top") return searchableText.includes("open top") || searchableText.includes("opentop");
  if (filter === "office") {
    return searchableText.includes("uso ufficio")
      || searchableText.includes("ufficio")
      || searchableText.includes("office")
      || type.includes("allestit");
  }

  return true;
}

export function ContainerCatalog({ products: initialProducts }: { products: Product[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let active = true;

    async function refreshProducts() {
      try {
        const ready = await waitForBackendReady({ maxWaitMs: 60000 });
        if (!active || !ready) return;

        const response = await fetch(`${API_URL}/api/products`, {
          cache: "no-store"
        });
        if (!response.ok) return;

        const nextProducts = await response.json() as Product[];
        if (active && Array.isArray(nextProducts)) setProducts(nextProducts);
      } catch {
        // Mantiene i dati iniziali se il catalogo live non è momentaneamente raggiungibile.
      } finally {
        if (active) setSyncing(false);
      }
    }

    void refreshProducts();
    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((product) => matchesFilter(product, filter)),
    [products, filter]
  );

  return (
    <>
      <div className="filter-bar">
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.key)}
              style={
                active
                  ? { background: "#173979", color: "#fff", borderColor: "#173979" }
                  : { background: "#fff", color: "#33445f", borderColor: "var(--line)" }
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {syncing ? <div className="catalog-sync-status">Aggiornamento disponibilità in corso…</div> : null}

      {filteredProducts.length > 0 ? (
        <div className="product-grid product-grid-wide">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div style={{ padding: "36px 0", color: "var(--muted)", fontWeight: 700 }}>
          Nessun container disponibile per il filtro selezionato.
        </div>
      )}
    </>
  );
}
