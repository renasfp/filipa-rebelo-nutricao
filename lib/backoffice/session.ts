import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import type { Role, User } from "@/lib/db/schema";
import { clientIp } from "@/lib/rate-limit";
import { randomToken, sha256 } from "./crypto";

// Sessões do backoffice em base de dados. O cookie guarda um token aleatório; a BD guarda só o
// SHA-256. Depois da palavra-passe a sessão fica "por verificar" (10 min) até ao código 2FA.

const COOKIE = "bo_session";
const PENDING_SECONDS = 10 * 60;
const SESSION_SECONDS = 7 * 86400;

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "totpEnabled">;

async function setCookie(token: string, maxAge: number) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/backoffice",
    maxAge,
  });
}

export async function requestMeta() {
  const h = await headers();
  return { ip: clientIp(h), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** Cria uma sessão por verificar (falta o código 2FA). */
export async function startSession(userId: string) {
  const db = await getDb();
  const token = randomToken();
  const { ip, userAgent } = await requestMeta();
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    verified: false,
    expiresAt: new Date(Date.now() + PENDING_SECONDS * 1000),
    ip,
    userAgent,
  });
  await setCookie(token, PENDING_SECONDS);
}

/** Depois do código 2FA: passa a sessão a verificada com a validade completa. */
export async function verifyCurrentSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return;
  const db = await getDb();
  await db
    .update(schema.sessions)
    .set({ verified: true, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) })
    .where(eq(schema.sessions.id, sha256(token)));
  await setCookie(token, SESSION_SECONDS);
}

export async function endSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  }
  (await cookies()).delete({ name: COOKIE, path: "/backoffice" });
}

/** Termina todas as sessões de um utilizador (mudança de palavra-passe, reposição de 2FA, desativação). */
export async function endAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

/** Sessão atual (verificada ou não) com o utilizador, ou null. */
export const currentSession = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      verified: schema.sessions.verified,
      user: {
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        totpEnabled: schema.users.totpEnabled,
      },
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.id, sha256(token)),
        gt(schema.sessions.expiresAt, new Date()),
        isNull(schema.users.disabledAt),
      ),
    );
  return row ?? null;
});

/** Usar no início de cada página e Server Action do painel. */
export async function verifySession(role?: Role): Promise<SessionUser> {
  const session = await currentSession();
  if (!session) redirect("/backoffice/login");
  if (!session.verified) redirect("/backoffice/2fa");
  if (role && session.user.role !== role) redirect("/backoffice");
  return session.user;
}
