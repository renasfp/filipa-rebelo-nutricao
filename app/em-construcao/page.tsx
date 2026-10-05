import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSiteAccess, safeNextPath, SITE_ACCESS_COOKIE } from "@/lib/site-access";
import AccessForm from "./AccessForm";

export const metadata: Metadata = {
  title: "Em construção · Filipa Rebelo Nutricionista",
  robots: { index: false, follow: false },
};

export default async function UnderConstructionPage({ searchParams }: PageProps<"/em-construcao">) {
  const next = safeNextPath((await searchParams).next);
  if (hasSiteAccess((await cookies()).get(SITE_ACCESS_COOKIE)?.value)) redirect(next);

  return (
    <main className="admin-login">
      <div className="admin-card">
        <span className="nav-logo">
          Filipa Rebelo <span>Nutricionista</span>
        </span>
        <h1>Site em construção</h1>
        <p className="construction-text">Estamos a preparar o novo site. Volte em breve!</p>
        <AccessForm next={next} />
      </div>
    </main>
  );
}
