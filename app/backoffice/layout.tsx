import type { Metadata } from "next";
import "./backoffice.css";

export const metadata: Metadata = {
  title: "Backoffice · Filipa Rebelo Nutricionista",
  robots: { index: false, follow: false },
};

// Sem verificação de sessão aqui: cada página e ação verifica (lib/backoffice/session.ts).
export default function BackofficeLayout({ children }: LayoutProps<"/backoffice">) {
  return <div className="bo">{children}</div>;
}
