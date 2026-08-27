"use client";

import {
  FormEvent,
  useEffect,
  useState
} from "react";
import { waitForBackendReady } from "@/lib/backendReady";
import styles from "./QuoteRequestButton.module.css";

type QuoteRequestButtonProps = {
  className?: string;
  label?: string;
  productId?: string;
  productTitle?: string;
};

type QuoteForm = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  message: string;
};

const EMPTY_FORM: QuoteForm = {
  firstName: "",
  lastName: "",
  phone: "",
  city: "",
  message: ""
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4001";

export function QuoteRequestButton({
  className = "",
  label = "Richiedi una quotazione",
  productId,
  productTitle
}: QuoteRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] =
    useState<QuoteForm>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [waking, setWaking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [open]);

  function closeModal() {
    if (sending) return;

    setOpen(false);
    setError("");
    setWaking(false);
  }

  function openModal() {
    setSuccess(false);
    setError("");
    setWaking(false);
    setOpen(true);
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const phone = form.phone.trim();
    const city = form.city.trim();
    const message = form.message.trim();

    if (
      firstName.length < 2 ||
      lastName.length < 2 ||
      phone.length < 5 ||
      city.length < 2 ||
      message.length < 5
    ) {
      setError(
        "Compila tutti i campi richiesti."
      );
      return;
    }

    setSending(true);
    setWaking(false);
    setError("");

    try {
      const backendReady =
        await waitForBackendReady({
          onWaking: () => setWaking(true)
        });

      if (!backendReady) {
        throw new Error(
          "Il servizio non è ancora disponibile. Riprova tra qualche secondo."
        );
      }

      setWaking(false);

      const response = await fetch(
        `${API_URL}/api/leads`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            productId:
              productId || undefined,
            name: `${firstName} ${lastName}`,
            phone,
            destination: city,
            quantity: 1,
            transportRequired: false,
            message: productTitle
              ? `Prodotto: ${productTitle}\n\n${message}`
              : message
          })
        }
      );

      if (!response.ok) {
        let messageText =
          "Invio della richiesta non riuscito.";

        try {
          const body = await response.json();

          if (body?.error) {
            messageText = body.error;
          }
        } catch {
          // Mantieni il messaggio generico.
        }

        throw new Error(messageText);
      }

      setSuccess(true);
      setForm(EMPTY_FORM);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Invio della richiesta non riuscito."
      );
    } finally {
      setWaking(false);
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={openModal}
      >
        {label}
      </button>

      {open && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-title"
          >
            <div className={styles.modalHead}>
              <div>
                <div
                  className={styles.eyebrow}
                >
                  RICHIESTA DI QUOTAZIONE
                </div>

                <h2 id="quote-title">
                  Ti ricontattiamo noi.
                </h2>

                <p>
                  Lasciaci i tuoi recapiti e
                  descrivi brevemente ciò di cui
                  hai bisogno.
                </p>
              </div>

              <button
                type="button"
                className={styles.close}
                onClick={closeModal}
                aria-label="Chiudi richiesta di quotazione"
              >
                ×
              </button>
            </div>

            {success ? (
              <div className={styles.success}>
                <div
                  className={
                    styles.successIcon
                  }
                >
                  ✓
                </div>

                <h3>Richiesta inviata</h3>

                <p>
                  Abbiamo ricevuto i tuoi dati.
                  Un nostro referente ti
                  ricontatterà appena possibile.
                </p>

                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  onClick={closeModal}
                >
                  Chiudi
                </button>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className={styles.form}
              >
                {productTitle && (
                  <div
                    className={
                      styles.productReference
                    }
                  >
                    Richiesta per{" "}
                    <strong>
                      {productTitle}
                    </strong>
                  </div>
                )}

                <div
                  className={
                    styles.twoColumns
                  }
                >
                  <label>
                    <span>Nome *</span>
                    <input
                      required
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          firstName:
                            event.target.value
                        })
                      }
                      placeholder="Nome"
                    />
                  </label>

                  <label>
                    <span>Cognome *</span>
                    <input
                      required
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          lastName:
                            event.target.value
                        })
                      }
                      placeholder="Cognome"
                    />
                  </label>
                </div>

                <div
                  className={
                    styles.twoColumns
                  }
                >
                  <label>
                    <span>
                      Numero di telefono *
                    </span>
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          phone:
                            event.target.value
                        })
                      }
                      placeholder="+39 333 1234567"
                    />
                  </label>

                  <label>
                    <span>Città *</span>
                    <input
                      required
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          city:
                            event.target.value
                        })
                      }
                      placeholder="Es. Salerno"
                    />
                  </label>
                </div>

                <label>
                  <span>
                    Descrivi la tua necessità *
                  </span>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        message:
                          event.target.value
                      })
                    }
                    placeholder="Es. Cerco un container 40' HC per uso deposito con consegna a..."
                  />
                </label>

                <p
                  className={
                    styles.contactNotice
                  }
                >
                  Inviando la richiesta ci
                  autorizzi a utilizzare i dati
                  indicati esclusivamente per
                  ricontattarti in merito alla
                  quotazione richiesta.
                </p>

                {waking && (
                  <div
                    className={
                      styles.wakingNotice
                    }
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      className={
                        styles.wakingSpinner
                      }
                      aria-hidden="true"
                    />

                    <div>
                      <strong>
                        Stiamo riattivando il
                        servizio…
                      </strong>
                      <span>
                        Il backend era in pausa.
                        Può richiedere qualche
                        secondo; la richiesta
                        partirà automaticamente
                        appena sarà pronto.
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div
                    className={styles.error}
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <div
                  className={styles.actions}
                >
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={closeModal}
                    disabled={sending}
                  >
                    Annulla
                  </button>

                  <button
                    type="submit"
                    className={
                      styles.primaryButton
                    }
                    disabled={sending}
                  >
                    {waking
                      ? "Riattivazione servizio…"
                      : sending
                        ? "Invio in corso…"
                        : "Invia richiesta"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
