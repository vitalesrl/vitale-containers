import Link from "next/link";
import type { Product } from "@/lib/types";

function formatPrice(price: number | null) {
  if (price === null || price <= 0) return "Prezzo su richiesta";
  return `€ ${price.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function availabilityLabel(value: number | null) {
  if (value === null) return "Disponibilità da confermare";
  if (value === 0) return "Non disponibile";
  return `${value} ${value === 1 ? "unità disponibile" : "unità disponibili"}`;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <div className={`product-image ${product.imageUrl ? "has-photo" : ""}`}>
        {product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.title} /> : <><div className="container-glyph" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span>{product.size}</span><small>{product.type}</small></>}
      </div>
      <div className="product-body">
        <div className="eyebrow">{product.location} · {product.condition}</div>
        <h3>{product.title}</h3>
        <div className={`availability ${product.availability === 0 ? "unavailable" : ""}`}>● {availabilityLabel(product.availability)}</div>
        <div className={`price ${product.price === null ? "price-request" : ""}`}>{formatPrice(product.price)} {product.price !== null && <small>{product.vatIncluded ? "IVA inclusa" : "+ IVA"}</small>}</div>
        <Link className="button button-dark" href={`/container/${product.slug}`}>Vedi dettagli</Link>
      </div>
    </article>
  );
}
