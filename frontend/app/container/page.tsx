import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { getProducts } from "@/lib/api";

export default async function CatalogPage() {
  const products = await getProducts();
  return (
    <main>
      <Header />
      <section className="page-head">
        <div className="eyebrow">CATALOGO VITALE S.R.L.</div>
        <h1>Container disponibili</h1>
        <p>Container marittimi usati in ottime condizioni strutturali, con ritiro a Salerno o possibilità di trasporto in tutta Italia. Prezzi e disponibilità vengono confermati su richiesta.</p>
      </section>
      <section className="section compact">
        <div className="filter-bar"><button>Tutti</button><button>20 piedi</button><button>40 piedi</button><button>High Cube</button><button>Reefer</button><button>Uso ufficio</button></div>
        <div className="product-grid product-grid-wide">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </section>
    </main>
  );
}
