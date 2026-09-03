import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./progression.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://tic-tac-toe-plus-alpha.stofs.chatgpt.site"),
  title: "Tic Tac Toe Plus",
  description:
    "Карточные крестики-нолики: собирайте линии, освобождайте поле и выигрывайте раунды.",
  openGraph: {
    title: "Tic Tac Toe Plus",
    description:
      "Собирайте линии, освобождайте поле и выигрывайте раунды.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Бумажное игровое поле Tic Tac Toe Plus с крестиками и ноликами",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
