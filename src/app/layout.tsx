import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Bolão Brasileirão",
  description: "Bolão do Campeonato Brasileiro entre amigos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
