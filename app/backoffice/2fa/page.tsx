import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { decrypt, encrypt, newTotpSecret, totpUri } from "@/lib/backoffice/crypto";
import { currentSession } from "@/lib/backoffice/session";
import { getDb, schema } from "@/lib/db";
import ActionForm from "../ActionForm";
import { logout, verifyTwoFactor } from "../actions";

export default async function TwoFactorPage() {
  const session = await currentSession();
  if (!session) redirect("/backoffice/login");
  if (session.verified) redirect("/backoffice");

  // Primeira vez: gera o segredo (guardado cifrado) e mostra o QR para a app de autenticação.
  let setup: { qr: string; secret: string } | null = null;
  if (!session.user.totpEnabled) {
    const db = await getDb();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.user.id));
    let secret = user.totpSecret ? decrypt(user.totpSecret) : null;
    if (!secret) {
      secret = newTotpSecret();
      await db.update(schema.users).set({ totpSecret: encrypt(secret) }).where(eq(schema.users.id, user.id));
    }
    setup = { qr: await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 400 }), secret };
  }

  return (
    <main className="bo-auth">
      <div className="bo-auth-card">
        <span className="bo-brand">
          Filipa Rebelo <span>Nutricionista</span>
        </span>
        {setup ? (
          <>
            <h1>Ativar a verificação em dois passos</h1>
            <p className="bo-muted">
              Lê este código com uma app de autenticação (Google Authenticator, Microsoft Authenticator,
              1Password…) e escreve o código de 6 dígitos que aparece.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada (data URL) */}
            <img className="bo-qr" src={setup.qr} alt="Código QR para a app de autenticação" />
            <details className="bo-details">
              <summary>Não consigo ler o código QR</summary>
              <p className="bo-secret">{setup.secret}</p>
            </details>
          </>
        ) : (
          <>
            <h1>Código de verificação</h1>
            <p className="bo-muted">Escreve o código de 6 dígitos da tua app de autenticação.</p>
          </>
        )}
        <ActionForm action={verifyTwoFactor} submit="Entrar" pending="A verificar…">
          <label>
            Código
            <input
              className="bo-code"
              name="code"
              inputMode="numeric"
              pattern="[0-9 ]{6,7}"
              autoComplete="one-time-code"
              required
              autoFocus
            />
          </label>
        </ActionForm>
        <form action={logout}>
          <button type="submit" className="bo-btn bo-btn-ghost bo-btn-small" style={{ marginTop: "1rem" }}>
            Cancelar
          </button>
        </form>
      </div>
    </main>
  );
}
