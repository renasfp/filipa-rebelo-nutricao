import { asc } from "drizzle-orm";
import { verifySession } from "@/lib/backoffice/session";
import { getDb, schema } from "@/lib/db";
import { CreateUserForm, UserActions } from "./UserForms";

export default async function UsersPage() {
  const admin = await verifySession("admin");
  const db = await getDb();
  const users = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt));

  return (
    <>
      <h1>Utilizadores</h1>
      {users.map((u) => (
        <article key={u.id} className="bo-card">
          <strong>{u.name}</strong> <span className="bo-muted bo-small">{u.email}</span>
          <div className="bo-chips">
            <span className="bo-chip">{u.role === "admin" ? "Administrador" : "Operação"}</span>
            <span className={`bo-chip ${u.totpEnabled ? "bo-chip-ok" : "bo-chip-media"}`}>
              {u.totpEnabled ? "2FA ativo" : "2FA por configurar"}
            </span>
            {u.disabledAt && <span className="bo-chip bo-chip-alta">Desativado</span>}
          </div>
          <div style={{ marginTop: "0.6rem" }}>
            <UserActions userId={u.id} disabled={!!u.disabledAt} self={u.id === admin.id} />
          </div>
        </article>
      ))}
      <h2>Novo utilizador</h2>
      <CreateUserForm />
    </>
  );
}
