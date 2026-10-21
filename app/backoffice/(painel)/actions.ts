"use server";

import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/backoffice/audit";
import { hashPassword, sha256, temporaryPassword, verifyPassword } from "@/lib/backoffice/crypto";
import { endAllSessions, verifySession } from "@/lib/backoffice/session";
import { CalError, cancelBooking, confirmBooking, declineBooking } from "@/lib/booking/calcom";
import { getDb, schema } from "@/lib/db";
import type { Role } from "@/lib/db/schema";
import { setPrice } from "@/lib/payments";

const MIN_PASSWORD = 12;

function calMessage(err: unknown) {
  return err instanceof CalError ? err.message.replace(/^Cal\.com [^:]+: /, "") : "Erro inesperado.";
}

// ─── Marcações (Cal.com) ───────────────────────────────

export type BookingAction = "confirmar" | "recusar" | "cancelar";

export async function bookingAction(uid: string, action: BookingAction, reason: string): Promise<string | null> {
  const user = await verifySession();
  const why = reason.trim().slice(0, 300) || "Indisponibilidade da nutricionista";
  try {
    if (action === "confirmar") await confirmBooking(uid);
    else if (action === "recusar") await declineBooking(uid, why);
    else await cancelBooking(uid, why);
  } catch (err) {
    console.error("[backoffice]", err);
    return `Não foi possível ${action}: ${calMessage(err)}`;
  }
  await audit(user.id, `marcacao.${action}`, uid, action === "confirmar" ? undefined : { motivo: why });
  revalidatePath("/backoffice", "layout");
  return null;
}

// ─── Conta ───────────────────────────────

export async function changePassword(_prev: string | null, formData: FormData): Promise<string | null> {
  const user = await verifySession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < MIN_PASSWORD) return `A nova palavra-passe tem de ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (next !== formData.get("confirm")) return "As palavras-passe novas não coincidem.";

  const db = await getDb();
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  if (!(await verifyPassword(current, row.passwordHash))) return "A palavra-passe atual está incorreta.";

  await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, user.id));
  // Termina as outras sessões; mantém esta.
  const token = (await cookies()).get("bo_session")?.value ?? "";
  await db
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, sha256(token))));
  await audit(user.id, "conta.palavra-passe");
  return "ok";
}

// ─── Utilizadores (só admin) ───────────────────────────────

export interface UserFormState {
  error?: string;
  /** Palavra-passe temporária, mostrada uma única vez. */
  created?: { email: string; password: string };
}

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await verifySession("admin");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : ("operacao" satisfies Role);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Indica o nome e um email válido." };

  const db = await getDb();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing) return { error: "Já existe um utilizador com esse email." };

  const password = temporaryPassword();
  await db.insert(schema.users).values({ name, email, role, passwordHash: await hashPassword(password) });
  await audit(admin.id, "utilizador.criar", email, { role });
  revalidatePath("/backoffice/utilizadores");
  return { created: { email, password } };
}

async function updateUser(userId: string, action: "repor-2fa" | "desativar" | "ativar" | "repor-palavra-passe") {
  const admin = await verifySession("admin");
  if (userId === admin.id && action !== "repor-palavra-passe") throw new Error("Não podes fazer isto à tua própria conta.");
  const db = await getDb();
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!target) throw new Error("Utilizador não encontrado.");

  let password: string | undefined;
  if (action === "repor-2fa") {
    await db
      .update(schema.users)
      .set({ totpSecret: null, totpEnabled: false, totpLastStep: null })
      .where(eq(schema.users.id, userId));
  } else if (action === "desativar") {
    await db.update(schema.users).set({ disabledAt: new Date() }).where(eq(schema.users.id, userId));
  } else if (action === "ativar") {
    await db.update(schema.users).set({ disabledAt: null }).where(eq(schema.users.id, userId));
  } else {
    password = temporaryPassword();
    await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, userId));
  }
  if (action !== "ativar") await endAllSessions(userId);
  await audit(admin.id, `utilizador.${action}`, target.email);
  revalidatePath("/backoffice/utilizadores");
  return { email: target.email, password };
}

export async function userAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const action = String(formData.get("action")) as Parameters<typeof updateUser>[1];
  if (!["repor-2fa", "desativar", "ativar", "repor-palavra-passe"].includes(action)) return { error: "Ação inválida." };
  try {
    const { email, password } = await updateUser(String(formData.get("userId")), action);
    return password ? { created: { email, password } } : {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

// ─── Preços ───────────────────────────────

export async function savePrice(_prev: string | null, formData: FormData): Promise<string | null> {
  const user = await verifySession();
  const slug = String(formData.get("slug") ?? "");
  const raw = String(formData.get("price") ?? "").trim().replace(",", ".");
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return "Tipo de consulta inválido.";
  let cents: number | null = null;
  if (raw) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 1000) return "Indica um preço entre 1 € e 1000 €, ou deixa vazio.";
    cents = Math.round(value * 100);
  }
  await setPrice(slug, cents, user.id);
  await audit(user.id, "preco.alterar", slug, { euros: cents === null ? null : cents / 100 });
  revalidatePath("/backoffice/precos");
  return "ok";
}
