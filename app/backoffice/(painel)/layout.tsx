import { Suspense } from "react";
import { findProblems } from "@/lib/backoffice/agenda";
import { currentSession } from "@/lib/backoffice/session";
import { logout } from "../actions";
import NavLinks from "./NavLinks";

// O layout não protege as páginas (cada página chama verifySession); só mostra o nome e a navegação.

async function ProblemsBadge({ isAdmin }: { isAdmin: boolean }) {
  const urgent = (await findProblems(isAdmin).catch(() => [])).filter((p) => p.severity !== "info").length;
  return urgent ? <span className="bo-badge">{urgent}</span> : null;
}

export default async function PanelLayout({ children }: LayoutProps<"/backoffice">) {
  const session = await currentSession();
  const user = session?.verified ? session.user : null;
  const isAdmin = user?.role === "admin";

  return (
    <>
      <header className="bo-top">
        <div className="bo-top-inner">
          <div className="bo-top-row">
            <span className="bo-brand">
              Filipa Rebelo <span>Backoffice</span>
            </span>
            {user && (
              <div className="bo-user">
                <span>{user.name}</span>
                <form action={logout}>
                  <button type="submit" className="bo-btn bo-btn-ghost bo-btn-small">
                    Sair
                  </button>
                </form>
              </div>
            )}
          </div>
          {user && (
            <NavLinks
              links={[
                { href: "/backoffice", label: "Agenda" },
                {
                  href: "/backoffice/problemas",
                  label: (
                    <>
                      Problemas
                      <Suspense>
                        <ProblemsBadge isAdmin={isAdmin} />
                      </Suspense>
                    </>
                  ),
                },
                { href: "/backoffice/registos", label: "Registos" },
                ...(isAdmin ? [{ href: "/backoffice/utilizadores", label: "Utilizadores" }] : []),
                { href: "/backoffice/conta", label: "Conta" },
              ]}
            />
          )}
        </div>
      </header>
      <main className="bo-main">{children}</main>
    </>
  );
}
