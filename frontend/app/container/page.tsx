import { Header } from "@/components/Header";
import { ContainerCatalog } from "@/components/ContainerCatalog";
import { getProducts } from "@/lib/api";

export default async function CatalogPage() {
  const products = await getProducts();

  return (
    <main>
      <Header />

      <section className="page-head">
        <div className="eyebrow">CATALOGO VITALE S.R.L.</div>
        <h1>Container disponibili</h1>
        <p>
          Container marittimi usati in ottime condizioni strutturali, con
          ritiro a Salerno o possibilità di trasporto in tutta Italia. Prezzi
          e disponibilità vengono confermati su richiesta.
        </p>
      </section>

      <section className="section compact">
        <ContainerCatalog products={products} />
      </section>
    </main>
  );
}
