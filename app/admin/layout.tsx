import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestão · Filipa Rebelo Nutricionista",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="admin">{children}</div>;
}
