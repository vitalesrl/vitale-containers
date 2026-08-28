"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackendWakeScreen } from "@/components/BackendWakeScreen";
import { waitForBackendReady } from "@/lib/backendReady";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BackendState =
  | "checking"
  | "waking"
  | "error";

export function AdminShell({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  const [ready, setReady] = useState(isLogin);
  const [backendState, setBackendState] =
    useState<BackendState>("checking");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function prepareAdmin() {
      setReady(false);
      setBackendState("checking");

      const { data } = await supabase.auth.getSession();

      if (!active) return;

      if (!data.session) {
        router.replace("/admin/login");
        return;
      }

      const backendReady = await waitForBackendReady({
        onWaking: () => {
          if (active) setBackendState("waking");
        }
      });

      if (!active) return;

      if (backendReady) {
        setReady(true);
      } else {
        setBackendState("error");
      }
    }

    void prepareAdmin();

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!session) {
            router.replace("/admin/login");
          }
        }
      );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [isLogin, retryToken, router]);

  if (isLogin) return <>{children}</>;

  if (!ready) {
    return (
      <BackendWakeScreen
        state={backendState}
        onRetry={() =>
          setRetryToken((value) => value + 1)
        }
      />
    );
  }

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link
          className="admin-brand-logo"
          href="/admin/prodotti"
          aria-label="Vitale S.r.l. - Gestionale"
        >
          <Image
            src="/vitale-logo.png"
            alt="Vitale S.r.l. - Logistica, Trasporti, Spedizioni"
            width={411}
            height={79}
            priority
          />
        </Link>

        <nav>
          <Link href="/admin/prodotti">
            Prodotti
          </Link>
          <Link href="/admin/richieste">
            Richieste
          </Link>
          <Link href="/admin/marketplace">
            Marketplace
          </Link>
        </nav>

        <div className="admin-version">
          V5.2 · Marketplace ordinato
        </div>

        <button
          className="back-site admin-logout"
          type="button"
          onClick={() => void logout()}
        >
          Esci
        </button>

        <Link
          className="back-site"
          href="/"
        >
          ← Vetrina pubblica
        </Link>
      </aside>

      <section className="admin-content">
        {children}
      </section>
    </div>
  );
}
