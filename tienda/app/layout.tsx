import type { Metadata } from "next";
import "./globals.css";
import "./admin-mobile.css";
import "./pricing.css";
import "./customer.css";
import "./maintenance.css";
import "./order-chat.css";
import "./ai-products.css";

export const metadata: Metadata = {
  title: "CAPA 3D · Ideas que toman forma",
  description: "Piezas de impresión 3D para tu espacio. Explora, personaliza y aparta sin registrarte.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
