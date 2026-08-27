export default function MarketplacePage() {
  return (
    <>
      <header className="admin-head">
        <div>
          <div className="eyebrow">MULTICANALE</div>
          <h1>Marketplace</h1>
          <p className="admin-subtitle">
            Il catalogo centrale è pronto per la pubblicazione sul sito Vitale e
            sui marketplace alternativi Subito.it ed eBay.
          </p>
        </div>
      </header>

      <section className="admin-panel" aria-label="Canali di vendita">
        <div className="channel-row">
          <span className="status-dot online" aria-hidden="true" />
          <strong>Sito Vitale</strong>
          <span>I prodotti marcati “Pubblicato” sono visibili nella vetrina.</span>
          <b>ATTIVO</b>
        </div>

        <div className="channel-row">
          <span className="status-dot" aria-hidden="true" />
          <strong>Subito.it</strong>
          <span>
            Da integrare dopo la verifica del canale professionale/API disponibile.
          </span>
          <b>NON COLLEGATO</b>
        </div>

        <div className="channel-row">
          <span className="status-dot" aria-hidden="true" />
          <strong>eBay</strong>
          <span>
            Canale alternativo predisposto; richiede un account venditore eBay e
            la configurazione delle API di pubblicazione.
          </span>
          <b>NON COLLEGATO</b>
        </div>
      </section>
    </>
  );
}
