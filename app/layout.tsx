import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  variable: "--serif",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Filipa Rebelo · Nutricionista | Viseu e Seia",
  description:
    "Nutricionista em Viseu e Seia. Consultas de nutrição, planos alimentares personalizados, reeducação alimentar e apoio contínuo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className={`${cormorantGaramond.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
