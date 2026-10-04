import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="admin-login">
      <div className="admin-card">
        <Link href="/" className="nav-logo">
          Filipa Rebelo <span>Nutricionista</span>
        </Link>
        <h1>Área de gestão</h1>
        <LoginForm />
      </div>
    </main>
  );
}
