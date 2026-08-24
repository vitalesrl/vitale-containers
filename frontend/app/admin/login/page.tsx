"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/admin/prodotti");
    });
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (error) { setError("Credenziali non valide."); setLoading(false); return; }
    router.replace("/admin/prodotti");
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <Image src="/vitale-logo.png" alt="Vitale S.r.l." width={411} height={79} priority />
        <div><div className="eyebrow">AREA RISERVATA</div><h1>Accesso gestionale</h1></div>
        {error && <div className="admin-alert error">{error}</div>}
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="button button-dark" disabled={loading}>{loading ? "Accesso…" : "Accedi"}</button>
      </form>
    </main>
  );
}
