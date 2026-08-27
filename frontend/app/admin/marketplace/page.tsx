"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import type {
  EbayCondition,
  EbayListing,
  EbayLocation,
  EbayPolicy,
  EbayResources,
  EbaySettings,
  EbayStatus,
  Product
} from "@/lib/types";

type SettingsDraft = Omit<EbaySettings, "environment" | "updatedAt">;
type ListingDraft = {
  categoryId: string;
  condition: EbayCondition;
  price: string;
  quantity: string;
  brand: string;
};

const emptySettings: SettingsDraft = {
  marketplaceId: "EBAY_IT",
  merchantLocationKey: "",
  fulfillmentPolicyId: "",
  paymentPolicyId: "",
  returnPolicyId: "",
  currency: "EUR"
};

const conditions: Array<{ value: EbayCondition; label: string }> = [
  { value: "NEW", label: "Nuovo" },
  { value: "NEW_OTHER", label: "Nuovo, altro" },
  { value: "NEW_WITH_DEFECTS", label: "Nuovo con difetti" },
  { value: "LIKE_NEW", label: "Come nuovo" },
  { value: "USED_EXCELLENT", label: "Usato eccellente" },
  { value: "USED_VERY_GOOD", label: "Usato molto buono" },
  { value: "USED_GOOD", label: "Usato buono" },
  { value: "USED_ACCEPTABLE", label: "Usato accettabile" },
  { value: "FOR_PARTS_OR_NOT_WORKING", label: "Ricambi / non funzionante" }
];

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}

function policyId(policy: EbayPolicy, type: "fulfillment" | "payment" | "return") {
  if (type === "fulfillment") return policy.fulfillmentPolicyId ?? "";
  if (type === "payment") return policy.paymentPolicyId ?? "";
  return policy.returnPolicyId ?? "";
}

function locationLabel(location: EbayLocation) {
  const address = location.location?.address;
  const place = [address?.city, address?.stateOrProvince, address?.country]
    .filter(Boolean)
    .join(", ");
  return [location.name || location.merchantLocationKey, place]
    .filter(Boolean)
    .join(" · ");
}

function listingLabel(listing?: EbayListing) {
  if (!listing) return "Non pubblicato";
  if (listing.status === "active") return "Attivo";
  if (listing.status === "paused") return "Ritirato";
  if (listing.status === "error") return "Errore";
  if (listing.status === "sold") return "Venduto";
  return "Bozza";
}

function defaultListingDraft(product: Product, listing?: EbayListing): ListingDraft {
  return {
    categoryId: listing?.categoryId ?? "",
    condition: listing?.metadata.condition ?? "USED_GOOD",
    price: String(listing?.price ?? product.price ?? ""),
    quantity: String(listing?.metadata.quantity ?? product.availability ?? 1),
    brand: listing?.metadata.brand ?? "Senza marca"
  };
}

export default function MarketplacePage() {
  const [status, setStatus] = useState<EbayStatus | null>(null);
  const [resources, setResources] = useState<EbayResources | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<EbayListing[]>([]);
  const [settings, setSettings] = useState<SettingsDraft>(emptySettings);
  const [drafts, setDrafts] = useState<Record<string, ListingDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const listingByProduct = useMemo(
    () => new Map(listings.map((listing) => [listing.productId, listing])),
    [listings]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextStatus = await adminApi.ebay.status();
      setStatus(nextStatus);
      setSettings(nextStatus.settings
        ? {
            marketplaceId: nextStatus.settings.marketplaceId,
            merchantLocationKey: nextStatus.settings.merchantLocationKey,
            fulfillmentPolicyId: nextStatus.settings.fulfillmentPolicyId,
            paymentPolicyId: nextStatus.settings.paymentPolicyId,
            returnPolicyId: nextStatus.settings.returnPolicyId,
            currency: nextStatus.settings.currency
          }
        : emptySettings);

      if (!nextStatus.connected) {
        setResources(null);
        setProducts([]);
        setListings([]);
        return;
      }

      const [nextResources, nextProducts, nextListings] = await Promise.all([
        adminApi.ebay.resources(),
        adminApi.products.list(),
        adminApi.ebay.listings()
      ]);
      setResources(nextResources);
      setProducts(nextProducts);
      setListings(nextListings);
      const byProduct = new Map(nextListings.map((listing) => [listing.productId, listing]));
      setDrafts((current) => {
        const next = { ...current };
        nextProducts.forEach((product) => {
          if (!next[product.id]) next[product.id] = defaultListingDraft(product, byProduct.get(product.id));
        });
        return next;
      });
    } catch (nextError) {
      setError(messageOf(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get("ebay");
    const oauthMessage = params.get("message");
    if (params.has("ebay")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    void load().then(() => {
      if (oauthResult === "connected") {
        setNotice("Account eBay collegato correttamente.");
      } else if (oauthResult === "error") {
        setError(oauthMessage || "Connessione eBay non riuscita.");
      }
    });
  }, [load]);

  async function connect() {
    setBusy("connect");
    setError("");
    try {
      const { authorizationUrl } = await adminApi.ebay.connect();
      window.location.assign(authorizationUrl);
    } catch (nextError) {
      setError(messageOf(nextError));
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Scollegare l'account eBay da questo ambiente?")) return;
    setBusy("disconnect");
    setError("");
    try {
      await adminApi.ebay.disconnect();
      setNotice("Account eBay scollegato.");
      await load();
    } catch (nextError) {
      setError(messageOf(nextError));
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    setBusy("settings");
    setError("");
    setNotice("");
    try {
      const saved = await adminApi.ebay.saveSettings(settings);
      setStatus((current) => current ? { ...current, settings: saved } : current);
      setNotice("Sede e policy eBay salvate.");
    } catch (nextError) {
      setError(messageOf(nextError));
    } finally {
      setBusy(null);
    }
  }

  function updateDraft<K extends keyof ListingDraft>(
    product: Product,
    field: K,
    value: ListingDraft[K]
  ) {
    setDrafts((current) => ({
      ...current,
      [product.id]: {
        ...(current[product.id] ?? defaultListingDraft(product, listingByProduct.get(product.id))),
        [field]: value
      }
    }));
  }

  async function publish(product: Product) {
    const draft = drafts[product.id] ?? defaultListingDraft(product, listingByProduct.get(product.id));
    const price = Number(draft.price);
    const quantity = Number(draft.quantity);
    if (!draft.categoryId.trim()) {
      setError(`Inserisci la categoria eBay per “${product.title}”.`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 1) {
      setError(`Prezzo o quantità non validi per “${product.title}”.`);
      return;
    }
    setBusy(product.id);
    setError("");
    setNotice("");
    try {
      const saved = await adminApi.ebay.publish(product.id, {
        categoryId: draft.categoryId.trim(),
        condition: draft.condition,
        price,
        quantity,
        brand: draft.brand.trim() || "Senza marca"
      });
      setListings((current) => [saved, ...current.filter((item) => item.productId !== product.id)]);
      setNotice(`“${product.title}” pubblicato e sincronizzato con eBay.`);
    } catch (nextError) {
      setError(messageOf(nextError));
      try {
        setListings(await adminApi.ebay.listings());
      } catch {}
    } finally {
      setBusy(null);
    }
  }

  async function withdraw(product: Product) {
    if (!window.confirm(`Ritirare “${product.title}” da eBay?`)) return;
    setBusy(product.id);
    setError("");
    setNotice("");
    try {
      const saved = await adminApi.ebay.withdraw(product.id);
      setListings((current) => [saved, ...current.filter((item) => item.productId !== product.id)]);
      setNotice(`“${product.title}” ritirato da eBay.`);
    } catch (nextError) {
      setError(messageOf(nextError));
    } finally {
      setBusy(null);
    }
  }

  const readyToPublish = Boolean(status?.settings);

  return (
    <>
      <header className="admin-head ebay-head">
        <div>
          <div className="eyebrow">MULTICANALE · EBAY SELL</div>
          <h1>Marketplace</h1>
          <p className="admin-subtitle">
            Collega l&apos;account venditore e pubblica il catalogo Vitale su eBay Italia.
          </p>
        </div>
        {status?.connected ? (
          <button className="button button-outline" type="button" onClick={() => void disconnect()} disabled={busy !== null}>
            {busy === "disconnect" ? "Disconnessione…" : "Scollega eBay"}
          </button>
        ) : null}
      </header>

      {error ? <div className="admin-alert error">{error}</div> : null}
      {notice ? <div className="admin-alert success">{notice}</div> : null}

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
          <span>In attesa della verifica del canale professionale/API disponibile.</span>
          <b>NON COLLEGATO</b>
        </div>
        <div className="channel-row">
          <span className={`status-dot ${status?.connected ? "online" : ""}`} aria-hidden="true" />
          <strong>eBay</strong>
          <span>
            {loading
              ? "Verifica collegamento…"
              : status?.connected
                ? `Account collegato in ambiente ${status.environment.toUpperCase()}.`
                : "Account venditore non ancora collegato."}
          </span>
          <b>{status?.connected ? "COLLEGATO" : "NON COLLEGATO"}</b>
        </div>
      </section>

      {!loading && status && !status.connected ? (
        <section className="admin-panel ebay-onboarding">
          <div>
            <div className="eyebrow">CONFIGURAZIONE</div>
            <h2>Collega eBay {status.environment === "sandbox" ? "Sandbox" : "Production"}</h2>
            <p>
              L&apos;accesso autorizza il gestionale a leggere le policy venditore e a creare,
              aggiornare e ritirare le inserzioni. Le credenziali non vengono mostrate nel browser.
            </p>
          </div>
          {!status.databaseReady ? (
            <div className="ebay-prerequisite">
              Prima esegui <code>database/ebay-sell.sql</code> nel SQL Editor di Supabase.
            </div>
          ) : null}
          {!status.credentialsConfigured ? (
            <div className="ebay-prerequisite">
              Variabili Render mancanti: <strong>{status.missingConfiguration.join(", ")}</strong>
            </div>
          ) : null}
          <button
            className="button button-dark"
            type="button"
            onClick={() => void connect()}
            disabled={!status.databaseReady || !status.credentialsConfigured || busy !== null}
          >
            {busy === "connect" ? "Apertura eBay…" : "Collega account eBay"}
          </button>
        </section>
      ) : null}

      {status?.connected && resources ? (
        <>
          <section className="admin-panel ebay-settings">
            <div className="editor-head">
              <div>
                <div className="eyebrow">PARAMETRI DI VENDITA</div>
                <h2>Sede e policy eBay</h2>
                <p className="admin-subtitle">
                  Seleziona le regole create nell&apos;account eBay per spedizione, pagamento e resi.
                </p>
              </div>
              <span className="ebay-environment">{status.environment}</span>
            </div>
            <div className="form-grid ebay-settings-grid">
              <label>
                Sede inventario
                <select value={settings.merchantLocationKey} onChange={(event) => setSettings({ ...settings, merchantLocationKey: event.target.value })}>
                  <option value="">Seleziona una sede</option>
                  {resources.locations.map((location) => (
                    <option key={location.merchantLocationKey} value={location.merchantLocationKey}>
                      {locationLabel(location)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Spedizione
                <select value={settings.fulfillmentPolicyId} onChange={(event) => setSettings({ ...settings, fulfillmentPolicyId: event.target.value })}>
                  <option value="">Seleziona una policy</option>
                  {resources.fulfillmentPolicies.map((policy) => {
                    const id = policyId(policy, "fulfillment");
                    return <option key={id} value={id}>{policy.name || id}</option>;
                  })}
                </select>
              </label>
              <label>
                Pagamento
                <select value={settings.paymentPolicyId} onChange={(event) => setSettings({ ...settings, paymentPolicyId: event.target.value })}>
                  <option value="">Seleziona una policy</option>
                  {resources.paymentPolicies.map((policy) => {
                    const id = policyId(policy, "payment");
                    return <option key={id} value={id}>{policy.name || id}</option>;
                  })}
                </select>
              </label>
              <label>
                Resi
                <select value={settings.returnPolicyId} onChange={(event) => setSettings({ ...settings, returnPolicyId: event.target.value })}>
                  <option value="">Seleziona una policy</option>
                  {resources.returnPolicies.map((policy) => {
                    const id = policyId(policy, "return");
                    return <option key={id} value={id}>{policy.name || id}</option>;
                  })}
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button
                className="button button-dark"
                type="button"
                disabled={busy !== null || !settings.merchantLocationKey || !settings.fulfillmentPolicyId || !settings.paymentPolicyId || !settings.returnPolicyId}
                onClick={() => void saveSettings()}
              >
                {busy === "settings" ? "Salvataggio…" : "Salva configurazione"}
              </button>
            </div>
          </section>

          <section className="admin-panel table-wrap ebay-catalog">
            <div className="table-toolbar ebay-toolbar">
              <div>
                <strong>Catalogo eBay</strong>
                <span>{products.length} prodotti · prezzi in EUR · durata GTC</span>
              </div>
              <button className="row-action-refresh" type="button" onClick={() => void load()} disabled={loading || busy !== null}>
                Aggiorna dati eBay
              </button>
            </div>
            {!readyToPublish ? (
              <div className="ebay-inline-note">Salva prima sede e policy eBay per abilitare la pubblicazione.</div>
            ) : null}
            {products.length === 0 ? (
              <div className="ebay-empty">Non ci sono prodotti nel catalogo.</div>
            ) : (
              <div className="ebay-product-list">
                {products.map((product) => {
                  const listing = listingByProduct.get(product.id);
                  const draft = drafts[product.id] ?? defaultListingDraft(product, listing);
                  const image = product.images?.find((item) => item.isPrimary)?.url || product.images?.[0]?.url || product.imageUrl;
                  return (
                    <article className={`ebay-product ${listing?.status === "error" ? "has-error" : ""}`} key={product.id}>
                      <div className="ebay-product-summary">
                        <div className="ebay-product-photo">
                          {image ? <img src={image} alt="" /> : <span>Nessuna foto</span>}
                        </div>
                        <div>
                          <strong>{product.title}</strong>
                          <small>{product.size} · {product.type}</small>
                          {listing?.externalUrl ? <a href={listing.externalUrl} target="_blank" rel="noreferrer">Apri annuncio eBay ↗</a> : null}
                        </div>
                      </div>
                      <div className="ebay-product-fields">
                        <label>
                          Categoria eBay (ID)
                          <input value={draft.categoryId} onChange={(event) => updateDraft(product, "categoryId", event.target.value)} placeholder="es. 80761" inputMode="numeric" />
                        </label>
                        <label>
                          Condizione
                          <select value={draft.condition} onChange={(event) => updateDraft(product, "condition", event.target.value as EbayCondition)}>
                            {conditions.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
                          </select>
                        </label>
                        <label>
                          Prezzo EUR
                          <input value={draft.price} onChange={(event) => updateDraft(product, "price", event.target.value)} type="number" min="0.01" step="0.01" />
                        </label>
                        <label>
                          Quantità
                          <input value={draft.quantity} onChange={(event) => updateDraft(product, "quantity", event.target.value)} type="number" min="1" step="1" />
                        </label>
                        <label>
                          Marca
                          <input value={draft.brand} onChange={(event) => updateDraft(product, "brand", event.target.value)} />
                        </label>
                      </div>
                      <div className="ebay-product-actions">
                        <span className={`ebay-listing-status ${listing?.status ?? "none"}`}>{listingLabel(listing)}</span>
                        <button
                          className="button button-dark"
                          type="button"
                          disabled={!readyToPublish || busy !== null}
                          onClick={() => void publish(product)}
                        >
                          {busy === product.id ? "Sincronizzazione…" : listing?.status === "active" ? "Aggiorna su eBay" : "Pubblica su eBay"}
                        </button>
                        {listing?.status === "active" ? (
                          <button className="button button-outline" type="button" disabled={busy !== null} onClick={() => void withdraw(product)}>
                            Ritira
                          </button>
                        ) : null}
                      </div>
                      {listing?.lastError ? <div className="ebay-listing-error">{listing.lastError}</div> : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
