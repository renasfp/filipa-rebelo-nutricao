import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb, schema } from "@/lib/db";
import ActionForm from "../ActionForm";
import { setupFirstAdmin } from "../actions";

/** Criação do primeiro administrador; só existe enquanto não houver utilizadores. */
export default async function SetupPage() {
  await connection(); // depende do estado da BD: nunca pré-renderizar no build
  const db = await getDb();
  const [{ total }] = await db.select({ total: count() }).from(schema.users);
  if (total > 0) redirect("/backoffice/login");

  return (
    <main className="bo-auth">
      <div className="bo-auth-card">
        <span className="bo-brand">
          Filipa Rebelo <span>Nutricionista</span>
        </span>
        <h1>Configurar o backoffice</h1>
        {process.env.BACKOFFICE_SETUP_TOKEN ? (
          <>
            <p className="bo-muted">
              Cria a conta de administrador. O código de configuração é o valor de BACKOFFICE_SETUP_TOKEN.
            </p>
            <ActionForm action={setupFirstAdmin} submit="Criar administrador" pending="A criar…">
              <label>
                Código de configuração
                <input type="password" name="token" required autoComplete="off" />
              </label>
              <label>
                Nome
                <input name="name" required autoComplete="name" />
              </label>
              <label>
                Email
                <input type="email" name="email" required autoComplete="username" />
              </label>
              <label>
                Palavra-passe <span className="bo-small">(mínimo 12 caracteres)</span>
                <input type="password" name="password" required minLength={12} autoComplete="new-password" />
              </label>
            </ActionForm>
          </>
        ) : (
          <p className="bo-muted">Falta definir BACKOFFICE_SETUP_TOKEN nas variáveis de ambiente.</p>
        )}
      </div>
    </main>
  );
}
