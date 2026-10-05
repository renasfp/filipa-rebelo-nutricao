import { createHash, createHmac, timingSafeEqual } from "crypto";

// Modo "em construção": enquanto SITE_PASSWORD estiver definida, todo o site exige
// a palavra-passe (ver proxy.ts). Para abrir o site ao público, basta remover a variável.

export const SITE_ACCESS_COOKIE = "site_access";
export const SITE_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Valor do cookie de acesso; muda (e invalida acessos antigos) quando a palavra-passe muda. */
export function siteAccessToken(): string | null {
  const password = process.env.SITE_PASSWORD;
  return password ? createHmac("sha256", password).update("site-access").digest("base64url") : null;
}

export function hasSiteAccess(cookie: string | undefined) {
  const token = siteAccessToken();
  return !token || (!!cookie && safeEqual(cookie, token));
}

export function checkSitePassword(password: string) {
  const expected = process.env.SITE_PASSWORD;
  return !!expected && safeEqual(password, expected);
}

/** Só aceita caminhos internos, para não permitir redirecionamentos para fora do site. */
export function safeNextPath(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
