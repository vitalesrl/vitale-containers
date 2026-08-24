import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand-logo" href="/" aria-label="Vitale S.r.l. - Home">
        <Image src="/vitale-logo.png" alt="Vitale S.r.l. - Logistica, Trasporti, Spedizioni" width={411} height={79} priority />
      </Link>
      <nav>
        <Link href="/container">Container</Link>
        <a href="/#caratteristiche">Caratteristiche</a>
        <a href="/#trasporto">Trasporto</a>
        <a href="/#contatti">Contatti</a>
        <Link className="admin-link" href="/admin">Area gestionale</Link>
      </nav>
    </header>
  );
}
