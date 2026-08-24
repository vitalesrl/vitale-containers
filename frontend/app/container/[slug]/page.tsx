import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ProductGallery } from "@/components/ProductGallery";
import { getProduct } from "@/lib/api";

function formatPrice(price: number | null) {
  if (price === null || price <= 0) return "Prezzo su richiesta";
  return `€ ${price.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function availabilityLabel(value: number | null) {
  if (value === null) return "Disponibilità da confermare";
  if (value === 0) return "Non disponibile";
  return `${value} ${value === 1 ? "unità disponibile" : "unità disponibili"}`;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <main>
      <Header />
      <section className="product-detail">
        <ProductGallery images={product.images ?? []} fallbackUrl={product.imageUrl} title={product.title} size={product.size} type={product.type} />
        <div className="detail-copy">
          <div className="eyebrow">{product.location} · {product.condition}</div>
          <h1>{product.title}</h1>
          <div className={`price big ${product.price === null ? "price-request" : ""}`}>{formatPrice(product.price)} {product.price !== null && <small>{product.vatIncluded ? "IVA inclusa" : "+ IVA"}</small>}</div>
          <div className={`availability big-availability ${product.availability === 0 ? "unavailable" : ""}`}>● {availabilityLabel(product.availability)}</div>
          <p>{product.description}</p>
          <ul className="product-benefits">
            <li>Struttura resistente e pronta all&apos;uso</li>
            <li>Ritiro a Salerno</li>
            <li>Trasporto disponibile in tutta Italia</li>
          </ul>
          <dl>
            <div><dt>Dimensione</dt><dd>{product.size}</dd></div>
            <div><dt>Tipologia</dt><dd>{product.type}</dd></div>
            <div><dt>Condizione</dt><dd>{product.condition}</dd></div>
            <div><dt>Deposito</dt><dd>{product.location}</dd></div>
            {product.lengthM && <div><dt>Lunghezza</dt><dd>{product.lengthM.toLocaleString("it-IT")} m</dd></div>}
            {product.widthM && <div><dt>Larghezza</dt><dd>{product.widthM.toLocaleString("it-IT")} m</dd></div>}
            {product.heightM && <div><dt>Altezza</dt><dd>{product.heightM.toLocaleString("it-IT")} m</dd></div>}
            {product.volumeM3 && <div><dt>Volume</dt><dd>circa {product.volumeM3.toLocaleString("it-IT")} m³</dd></div>}
          </dl>
          <div className="hero-actions">
            <a className="button button-accent" href="tel:089381688">Chiama 089 381688</a>
            <a className="button button-outline" href="/#contatti">Richiedi informazioni</a>
            <Link className="button button-outline" href="/container">Torna al catalogo</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
