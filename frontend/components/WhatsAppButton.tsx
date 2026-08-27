"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import styles from "./WhatsAppButton.module.css";

const DEFAULT_MESSAGE =
  "Buongiorno, vorrei ricevere informazioni sui container disponibili.";

function normalizeWhatsAppNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(
    process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE?.trim() || DEFAULT_MESSAGE
  );

  const number = useMemo(
    () =>
      normalizeWhatsAppNumber(
        process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""
      ),
    []
  );

  if (!number) return null;

  function openWhatsApp() {
    const text = message.trim();
    if (!text) return;

    const href = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

    const newWindow = window.open(href, "_blank");

    if (newWindow) {
      newWindow.opener = null;
    } else {
      window.location.assign(href);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openWhatsApp();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className={styles.wrapper}>
      {open && (
        <section
          className={styles.chat}
          aria-label="Chat WhatsApp Vitale S.r.l."
        >
          <header className={styles.chatHeader}>
            <div className={styles.avatar} aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path
                  fill="currentColor"
                  d="M16.04 3C9.41 3 4.02 8.32 4.02 14.86c0 2.31.68 4.56 1.97 6.48L4 29l7.88-2.04a12.2 12.2 0 0 0 4.15.72h.01c6.62 0 12.01-5.32 12.01-11.86C28.05 9.32 22.66 3 16.04 3Zm0 21.68h-.01a9.19 9.19 0 0 1-3.65-.75l-.52-.21-4.67 1.21 1.25-4.48-.34-.55a8.64 8.64 0 0 1-1.38-4.66c0-4.78 3.99-8.67 8.9-8.67 4.9 0 8.89 3.89 8.89 8.67 0 4.79-3.99 8.68-8.89 8.68Z"
                />
              </svg>
            </div>

            <div className={styles.chatIdentity}>
              <strong>Vitale S.r.l.</strong>
              <span>WhatsApp</span>
            </div>

            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="Chiudi chat WhatsApp"
            >
              ×
            </button>
          </header>

          <div className={styles.chatBody}>
            <div className={styles.introBubble}>
              <strong>Vitale S.r.l.</strong>
              <p>
                Ciao! Scrivici per disponibilità, prezzi, trasporto o
                informazioni sui container.
              </p>
              <small>Rispondiamo appena possibile</small>
            </div>
          </div>

          <form className={styles.composerForm} onSubmit={handleSubmit}>
            <div className={styles.composer}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                aria-label="Messaggio WhatsApp"
                placeholder="Scrivi un messaggio..."
              />

              <button
                type="submit"
                className={styles.send}
                disabled={!message.trim()}
                aria-label="Continua su WhatsApp"
                title="Continua su WhatsApp"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M2.3 3.3a1 1 0 0 1 1.06-.21l17 8a1 1 0 0 1 0 1.82l-17 8A1 1 0 0 1 2 20v-5.4a1 1 0 0 1 .77-.97L13 11.25 2.77 8.87A1 1 0 0 1 2 7.9V4a1 1 0 0 1 .3-.7Z"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.hint}>
              Invio per continuare su WhatsApp · Shift+Invio per andare a capo
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`${styles.whatsapp} ${open ? styles.open : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Chiudi chat WhatsApp" : "Apri chat WhatsApp"}
      >
        <span className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 32 32" className={styles.icon}>
            <path
              fill="currentColor"
              d="M16.04 3C9.41 3 4.02 8.32 4.02 14.86c0 2.31.68 4.56 1.97 6.48L4 29l7.88-2.04a12.2 12.2 0 0 0 4.15.72h.01c6.62 0 12.01-5.32 12.01-11.86C28.05 9.32 22.66 3 16.04 3Zm0 21.68h-.01a9.19 9.19 0 0 1-3.65-.75l-.52-.21-4.67 1.21 1.25-4.48-.34-.55a8.64 8.64 0 0 1-1.38-4.66c0-4.78 3.99-8.67 8.9-8.67 4.9 0 8.89 3.89 8.89 8.67 0 4.79-3.99 8.68-8.89 8.68Zm4.89-6.48c-.27-.13-1.59-.77-1.84-.86-.25-.09-.43-.13-.61.13-.18.26-.7.86-.86 1.04-.16.17-.31.2-.58.07-.27-.13-1.14-.41-2.17-1.3-.8-.7-1.34-1.56-1.5-1.82-.16-.26-.02-.4.12-.53.12-.12.27-.3.4-.45.13-.15.18-.26.27-.43.09-.17.04-.32-.02-.45-.07-.13-.61-1.44-.84-1.97-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.47.07-.72.32-.25.26-.95.91-.95 2.22 0 1.31.97 2.58 1.11 2.75.13.17 1.9 2.86 4.61 4 .64.28 1.14.45 1.53.57.64.2 1.23.17 1.69.1.52-.08 1.59-.64 1.81-1.26.22-.62.22-1.15.16-1.26-.07-.11-.25-.17-.52-.3Z"
            />
          </svg>
        </span>

        <span className={styles.label}>
          <strong>WhatsApp</strong>
          <small>{open ? "Chat aperta" : "Scrivici ora"}</small>
        </span>
      </button>
    </div>
  );
}
