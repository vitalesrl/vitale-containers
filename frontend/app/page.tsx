import Link from "next/link";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { getProducts } from "@/lib/api";
import styles from "./home.module.css";

const dimensions = [
  { name: "20' Dry Van / General Purpose", length: "6,06 m", width: "2,44 m", height: "2,59 m", volume: "≈ 33 m³" },
  { name: "40' Dry Van / General Purpose", length: "12,19 m", width: "2,44 m", height: "2,59 m", volume: "≈ 67 m³" },
  { name: "40' High Cube", length: "12,19 m", width: "2,44 m", height: "2,90 m", volume: "≈ 76 m³" },
  { name: "45' High Cube Pallet Wide", length: "13,716 m", width: "2,500 m", height: "2,896 m", volume: "86 m³" }
];

const useCases = [
  {
    number: "01",
    label: "STOCCAGGIO",
    title: "Magazzino e deposito",
    text: "Uno spazio robusto e protetto per attrezzature, materiali, ricambi e merci."
  },
  {
    number: "02",
    label: "LOGISTICA",
    title: "Trasporto e movimentazione",
    text: "Formati standardizzati e versatili per semplificare movimentazione, spedizione e operatività."
  },
  {
    number: "03",
    label: "SPAZI OPERATIVI",
    title: "Cantieri e uffici",
    text: "Soluzioni rapide per uffici temporanei, locali tecnici, spogliatoi e aree di servizio."
  },
  {
    number: "04",
    label: "PROGETTI SPECIALI",
    title: "Industria e trasformazioni",
    text: "Una base solida per impianti tecnici, allestimenti e progetti personalizzati."
  }
];

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main>
      <Header />

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow light">VITALE S.R.L. · SALERNO</div>
          <h1>Container marittimi usati.<br />Robusti, versatili, pronti all&apos;uso.</h1>
          <p>Vendiamo container marittimi usati in ottime condizioni strutturali, ideali per magazzino, deposito attrezzi, trasporti, cantieri e progetti abitativi o industriali.</p>
          <div className="hero-actions">
            <Link className="button button-accent" href="/container">Scopri i container</Link>
            <a className="button button-ghost" href="#contatti">Richiedi informazioni</a>
          </div>
          <div className="hero-trust">
            <span>Acciaio Corten</span><span>Impermeabili</span><span>Pronti all&apos;uso</span>
          </div>
        </div>
        <aside className="hero-panel">
          <div className="hero-panel-label">DISPONIBILI</div>
          <strong>20&apos; · 40&apos; · 45&apos; · HC</strong>
          <p>Dry Van/General Purpose, High Cube, High Cube Pallet Wide, Reefer refrigerati e container allestiti uso ufficio.</p>
          <div className="hero-panel-line"></div>
          <span>Ritiro a Salerno o trasporto in tutta Italia.</span>
        </aside>
      </section>

      <section className="section section-intro">
        <div className="section-heading">
          <div><div className="eyebrow">VENDITA CONTAINER</div><h2>Tipologie disponibili</h2></div>
          <Link href="/container">Vedi tutto →</Link>
        </div>
        <p className="lead-copy">Una gamma pensata per esigenze logistiche, operative e di stoccaggio. La disponibilità viene confermata al momento della richiesta.</p>
        <div className="product-grid product-grid-wide">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </section>

      <section className={styles.solutions}>
        <div className={styles.solutionsHead}>
          <div>
            <div className={styles.eyebrow}>SOLUZIONI SU MISURA</div>
            <h2>Dalla logistica al cantiere,<br />lo spazio che serve.</h2>
          </div>

          <div className={styles.solutionsIntro}>
            <p>
              Un container non è solo trasporto: può diventare deposito,
              spazio operativo o la base per un progetto personalizzato.
            </p>
            <Link href="/container" className={styles.solutionsLink}>
              Scopri le tipologie <span>→</span>
            </Link>
          </div>
        </div>

        <div className={styles.solutionGrid}>
          {useCases.map((item) => (
            <article className={styles.solutionCard} key={item.number}>
              <div className={styles.cardTop}>
                <span className={styles.cardNumber}>{item.number}</span>
                <span className={styles.cardLabel}>{item.label}</span>
              </div>
              <div className={styles.cardBody}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <span className={styles.cardLine} aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="caratteristiche">
        <div className="section-heading">
          <div><div className="eyebrow">DIMENSIONI</div><h2>Dry Van, High Cube e Pallet Wide</h2></div>
        </div>
        <div className="spec-grid">
          {dimensions.map((item) => (
            <article className="spec-card" key={item.name}>
              <h3>{item.name}</h3>
              <dl>
                <div><dt>Lunghezza</dt><dd>{item.length}</dd></div>
                <div><dt>Larghezza</dt><dd>{item.width}</dd></div>
                <div><dt>Altezza</dt><dd>{item.height}</dd></div>
                <div><dt>Volume</dt><dd>{item.volume}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-strip">
        <div><strong>Impermeabili e resistenti</strong><span>Strutture selezionate per offrire solidità e protezione.</span></div>
        <div><strong>Acciaio Corten</strong><span>Struttura progettata per resistere alle condizioni tipiche dell&apos;ambiente marittimo.</span></div>
        <div><strong>Porte a due ante</strong><span>Accesso pratico alle merci e facilità nelle operazioni di carico.</span></div>
        <div><strong>Pavimento in legno marino</strong><span>Superficie robusta e adatta all&apos;uso operativo.</span></div>
      </section>

      <section className="transport-band" id="trasporto">
        <div>
          <div className="eyebrow light">RITIRO O CONSEGNA</div>
          <h2>Trasporto disponibile in tutta Italia.</h2>
          <p>È possibile ritirare il container in sede oppure richiedere l&apos;organizzazione del trasporto. I costi vengono valutati in base alla destinazione e alla tipologia di container.</p>
        </div>
        <a className="button button-light" href="#contatti">Richiedi una quotazione</a>
      </section>

      <section className="contact-section" id="contatti">
        <div className="contact-title">
          <div className="eyebrow">CONTATTI</div>
          <h2>Parliamo della soluzione più adatta.</h2>
          <p>Per disponibilità, prezzi, trasporto e maggiori informazioni, contatta Vitale S.r.l.</p>
        </div>
        <div className="contact-grid">
          <article>
            <span>SEDE LEGALE</span>
            <h3>Zona Porto · Salerno</h3>
            <p>Via Ligea, 86<br />84124 Salerno (SA)</p>
            <a href="tel:089235288">Tel-Fax 089 235288</a>
          </article>
          <article>
            <span>SEDE OPERATIVA</span>
            <h3>Salerno</h3>
            <p>Via Dei Carrari, 35/A<br />84133 Salerno (SA)</p>
            <a href="tel:089381688">Tel. 089 381688</a>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div><strong>VITALE S.R.L.</strong><span>Logistica · Trasporti · Spedizioni</span></div>
        <span>Vendita container marittimi · Salerno</span>
      </footer>
    </main>
  );
}
