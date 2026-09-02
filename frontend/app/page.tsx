import Link from "next/link";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { QuoteRequestButton } from "@/components/QuoteRequestButton";
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

const faqs = [
  {
    question: "Quali tipologie di container sono disponibili?",
    answer:
      "La disponibilità può includere container 20' e 40' Dry Van/General Purpose, 40' High Cube, 45' High Cube Pallet Wide, Reefer refrigerati e soluzioni allestite uso ufficio. Le unità effettivamente disponibili vengono confermate al momento della richiesta."
  },
  {
    question: "Qual è la differenza tra un container standard e un High Cube?",
    answer:
      "Il container High Cube offre una maggiore altezza: circa 2,90 m esterni rispetto ai 2,59 m di un modello standard. È indicato quando serve più volume interno, tenendo conto degli spazi di accesso e posizionamento."
  },
  {
    question: "Un container marittimo può essere usato come deposito o magazzino?",
    answer:
      "Sì. La struttura in acciaio Corten, le porte a due ante e il pavimento resistente rendono il container una soluzione pratica per custodire merci, materiali e attrezzature. La tipologia più adatta dipende dal contenuto e dall'uso previsto."
  },
  {
    question: "In quali condizioni vengono venduti i container usati?",
    answer:
      "I container vengono proposti con fotografie e informazioni sulle condizioni disponibili per la singola unità. Prima dell'acquisto confermiamo disponibilità, caratteristiche e stato del container scelto."
  },
  {
    question: "È disponibile la consegna del container?",
    answer:
      "Sì. È possibile ritirare il container a Salerno oppure richiedere l'organizzazione del trasporto verso la destinazione indicata, in tutta Italia."
  },
  {
    question: "Il costo del trasporto è incluso nel prezzo?",
    answer:
      "Il trasporto viene normalmente calcolato separatamente. Il preventivo dipende dalla destinazione, dalla tipologia di container e dalle condizioni necessarie per scarico e posizionamento."
  },
  {
    question: "Come scelgo la misura più adatta?",
    answer:
      "La scelta dipende dallo spazio disponibile, dal volume da contenere, dagli accessi al sito e dall'impiego previsto. Indicando questi elementi nella richiesta, possiamo aiutarti a confrontare le soluzioni disponibili."
  },
  {
    question: "Servono autorizzazioni per posizionare un container?",
    answer:
      "Le eventuali autorizzazioni dipendono dal luogo, dalla durata e dall'uso previsto. Prima del posizionamento è opportuno verificare i requisiti con il Comune competente o con un tecnico abilitato."
  }
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer
    }
  }))
};

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
        <QuoteRequestButton className="button button-light" />
      </section>

      <section className={styles.faqSection} id="faq">
        <div className={styles.faqIntro}>
          <div className={styles.eyebrow}>DOMANDE FREQUENTI</div>
          <h2>Tutto quello che serve sapere prima di scegliere.</h2>
          <p>
            Misure, condizioni, trasporto e posizionamento: qui trovi le
            risposte alle domande più comuni sui container marittimi.
          </p>
          <a href="#contatti" className={styles.faqLink}>
            Hai un&apos;altra domanda? Contattaci <span>→</span>
          </a>
        </div>

        <div className={styles.faqList}>
          {faqs.map((item, index) => (
            <details className={styles.faqItem} key={item.question}>
              <summary>
                <span className={styles.faqNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span>{item.question}</span>
                <span className={styles.faqIcon} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
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
            <a href="tel:089235288">Tel. 089 235288</a>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div><strong>VITALE S.R.L.</strong><span>Logistica · Trasporti · Spedizioni</span></div>
        <span>Vendita container marittimi · Salerno</span>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
    </main>
  );
}
