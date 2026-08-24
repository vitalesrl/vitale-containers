"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [ready, setReady] = useState(isLogin);

  useEffect(() => {
    if (isLogin) { setReady(true); return; }
    const supabase = getSupabaseBrowserClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) router.replace("/admin/login");
      else setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/admin/login");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!ready) return <div className="admin-auth-loading">Verifica sessione…</div>;

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand-logo" href="/admin/prodotti" aria-label="Vitale S.r.l. - Gestionale">
          <Image src="/vitale-logo.png" alt="Vitale S.r.l. - Logistica, Trasporti, Spedizioni" width={411} height={79} priority />
        </Link>
        <nav>
          <Link href="/admin/prodotti">Prodotti</Link>
          <Link href="/admin/richieste">Richieste</Link>
          <Link href="/admin/marketplace">Marketplace</Link>
        </nav>
        <div className="admin-version">V4.5 · Production/Auth</div>
        <button className="back-site admin-logout" type="button" onClick={() => void logout()}>Esci</button>
        <Link className="back-site" href="/">← Vetrina pubblica</Link>
      </aside>
      <section className="admin-content">{children}</section>
    </div>
  );
}
