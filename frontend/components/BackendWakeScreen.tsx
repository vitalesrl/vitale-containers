"use client";

import styles from "./BackendWakeScreen.module.css";

type BackendWakeScreenProps = {
  state: "checking" | "waking" | "error";
  onRetry?: () => void;
};

export function BackendWakeScreen({
  state,
  onRetry
}: BackendWakeScreenProps) {
  const isError = state === "error";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {!isError && (
          <div
            className={styles.spinner}
            aria-hidden="true"
          />
        )}

        <div className={styles.eyebrow}>
          AREA GESTIONALE
        </div>

        <h1>
          {state === "checking"
            ? "Connessione al gestionale…"
            : state === "waking"
              ? "Stiamo riattivando il servizio…"
              : "Servizio temporaneamente non disponibile"}
        </h1>

        <p>
          {state === "checking"
            ? "Verifichiamo che il backend sia disponibile."
            : state === "waking"
              ? "Il backend era in pausa. Può richiedere qualche secondo: l’accesso continuerà automaticamente appena il servizio sarà pronto."
              : "Il backend non ha risposto entro il tempo previsto. Puoi riprovare senza ricaricare manualmente la pagina."}
        </p>

        {isError && onRetry && (
          <button
            type="button"
            className={styles.retry}
            onClick={onRetry}
          >
            Riprova
          </button>
        )}
      </section>
    </main>
  );
}
