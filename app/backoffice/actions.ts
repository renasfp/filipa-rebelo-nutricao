"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { audit } from "@/lib/backoffice/audit";
import { decrypt, hashPassword, verifyPassword, verifyTotp } from "@/lib/backoffice/crypto";
import { currentSession, endSession, requestMeta, startSession, verifyCurrentSession } from "@/lib/backoffice/session";
import { getDb, schema } from "@/lib/db";
import { countFailure, overLimit } from "@/lib/rate-limit";

const WINDOW = 15 * 60;
const MIN_PASSWORD = 12;
// Comparação contra um hash fixo quando o email não existe, para a resposta demorar o mesmo.
const DUMMY_HASH = "scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const { ip } = await requestMeta();
  const blocked = "Demasiadas tentativas falhadas. Tenta de novo daqui a 15 minutos.";
  if ((await overLimit("bo-login-ip", ip, 10)) || (await overLimit("bo-login-email", email, 5))) return blocked;

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.disabledAt) {
    await countFailure("bo-login-ip", ip, WINDOW);
    await countFailure("bo-login-email", email, WINDOW);
    await audit(user?.id ?? null, "login.falhou", email);
    return "Email ou palavra-passe incorretos.";
  }

  await startSession(user.id);
  redirect("/backoffice/2fa");
}

export async function verifyTwoFactor(_prev: string | null, formData: FormData): Promise<string | null> {
  const session = await currentSession();
  if (!session) redirect("/backoffice/login");
  const { ip } = await requestMeta();
  if (await overLimit("bo-2fa", ip, 10)) return "Demasiadas tentativas. Tenta de novo daqui a 15 minutos.";

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.user.id));
  if (!user?.totpSecret) redirect("/backoffice/2fa");
  const step = verifyTotp(decrypt(user.totpSecret), String(formData.get("code") ?? ""), user.totpLastStep);
  if (step === null) {
    await countFailure("bo-2fa", ip, WINDOW);
    return "Código inválido ou já usado. Usa o código atual da app.";
  }

  await db
    .update(schema.users)
    .set({ totpEnabled: true, totpLastStep: step })
    .where(eq(schema.users.id, user.id));
  await verifyCurrentSession();
  await audit(user.id, user.totpEnabled ? "login" : "2fa.configurado");
  redirect("/backoffice");
}

export async function logout() {
  const session = await currentSession();
  await endSession();
  if (session) await audit(session.user.id, "logout");
  redirect("/backoffice/login");
}

/** Cria o primeiro administrador (só funciona com a BD sem utilizadores e o BACKOFFICE_SETUP_TOKEN). */
export async function setupFirstAdmin(_prev: string | null, formData: FormData): Promise<string | null> {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const expected = process.env.BACKOFFICE_SETUP_TOKEN;
  const { ip } = await requestMeta();
  if (await overLimit("bo-setup", ip, 5)) return "Demasiadas tentativas. Tenta de novo daqui a 15 minutos.";
  if (!expected || field("token") !== expected) {
    await countFailure("bo-setup", ip, WINDOW);
    return "Código de configuração inválido.";
  }

  const db = await getDb();
  const [{ total }] = await db.select({ total: count() }).from(schema.users);
  if (total > 0) return "O backoffice já está configurado.";

  const name = field("name");
  const email = field("email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Indica o nome e um email válido.";
  if (password.length < MIN_PASSWORD) return `A palavra-passe tem de ter pelo menos ${MIN_PASSWORD} caracteres.`;

  const [user] = await db
    .insert(schema.users)
    .values({ name, email, role: "admin", passwordHash: await hashPassword(password) })
    .returning({ id: schema.users.id });
  await audit(user.id, "utilizador.criar", email, { role: "admin", primeiro: true });
  await startSession(user.id);
  redirect("/backoffice/2fa");
}
