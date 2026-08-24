"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
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

function normalizeSize(value: string) {
  const normalized = (value || "").toLowerCase().replace(/\s+/g, "").replace(/[’′]/g, "'");
  if (normalized.startsWith("45")) return "45hc";
  if (normalized.includes("40hc") || normalized.includes("40'hc") || normalized.includes("highcube")) return "40hc";
  if (normalized.startsWith("40")) return "40";
  if (normalized.startsWith("20")) return "20";
  return normalized;
}

function normalizeType(value: string) {
  return (value || "").toLowerCase().trim();
}

function matchesFilter(product: Product, filter: FilterKey) {
  if (filter === "all") return true;

  const size = normalizeSize(product.size);
  const type = normalizeType(product.type);

  if (filter === "20") return size === "20";
  if (filter === "40") return size === "40";
  if (filter === "40hc") return size === "40hc";
  if (filter === "45hc-pw") return size === "45hc" || type.includes("pallet wide") || type.includes("palletwide");
  if (filter === "reefer") return type.includes("reefer");
  if (filter === "open-top") return type.includes("open top") || type.includes("opentop");
  if (filter === "office") return type.includes("uso ufficio") || type.includes("ufficio") || type.includes("office");

  return true;
}

export function ContainerCatalog({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

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
