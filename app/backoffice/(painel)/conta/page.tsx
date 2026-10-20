import { verifySession } from "@/lib/backoffice/session";
import PasswordForm from "./PasswordForm";

export default async function AccountPage() {
  const user = await verifySession();
  return (
    <>
      <h1>Conta</h1>
      <p className="bo-muted">
        {user.name} · {user.email} · {user.role === "admin" ? "Administrador" : "Operação"}
      </p>
      <h2>Mudar palavra-passe</h2>
      <PasswordForm />
      <p className="bo-muted bo-small" style={{ marginTop: "1rem" }}>
        Perdeste o acesso à app de autenticação? Pede a um administrador para repor o teu 2FA.
      </p>
    </>
  );
}
