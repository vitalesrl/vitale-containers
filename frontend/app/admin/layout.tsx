import Image from "next/image";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
        <div className="admin-version">V4.4 · prodotti / media fix</div>
        <Link className="back-site" href="/">← Vetrina pubblica</Link>
      </aside>
      <section className="admin-content">{children}</section>
    </div>
  );
}
