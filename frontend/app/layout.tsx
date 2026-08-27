import type { Metadata } from "next";
import { BackendWakeUp } from "@/components/BackendWakeUp";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vitale S.r.l. | Vendita Container Marittimi",
    template: "%s | Vitale S.r.l."
  },
  description: "Vendita di container marittimi usati a Salerno: 20 piedi, 40 piedi, High Cube, Reefer e container uso ufficio. Ritiro in sede o trasporto in tutta Italia.",
  keywords: ["container marittimi usati", "vendita container Salerno", "container 20 piedi", "container 40 piedi", "container High Cube", "container Reefer", "container uso ufficio"]
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>
        {children}
        <BackendWakeUp />
        <WhatsAppButton />
      </body>
    </html>
  );
}
