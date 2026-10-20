import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/backoffice/session";
import { getDb, schema } from "@/lib/db";
import ActionForm from "../ActionForm";
import { login } from "../actions";

export default async function LoginPage() {
  const session = await currentSession();
  if (session) redirect(session.verified ? "/backoffice" : "/backoffice/2fa");
  const db = await getDb();
  const [{ total }] = await db.select({ total: count() }).from(schema.users);
  if (total === 0) redirect("/backoffice/configurar");

  return (
    <main className="bo-auth">
      <div className="bo-auth-card">
        <span className="bo-brand">
          Filipa Rebelo <span>Nutricionista</span>
        </span>
        <h1>Backoffice</h1>
        <p className="bo-muted">Entra com o teu email e palavra-passe.</p>
        <ActionForm action={login} submit="Continuar" pending="A verificar…">
          <label>
            Email
            <input type="email" name="email" required autoComplete="username" autoFocus />
          </label>
          <label>
            Palavra-passe
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
        </ActionForm>
      </div>
    </main>
  );
}
