import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link href="/admin" className="nav-logo">
            Filipa Rebelo <span>Gestão</span>
          </Link>
          <div className="admin-nav">
            <Link href="/admin">Pedidos</Link>
            <Link href="/admin/definicoes">Definições</Link>
            <Link href="/marcar-consulta" target="_blank">
              Ver página
            </Link>
            <form action={logout}>
              <button type="submit">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </>
  );
}
