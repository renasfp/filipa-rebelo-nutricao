import { createSign } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { BusyInterval } from "./availability";

// Lê apenas livre/ocupado (API FreeBusy) — nunca títulos nem detalhes das marcações.
// Credenciais: GOOGLE_SERVICE_ACCOUNT_KEY (conteúdo do JSON da conta de serviço) ou,
// em desenvolvimento, o ficheiro .data/google-service-account.json.

const SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const CACHE_MS = 2 * 60 * 1000;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

const calendarIds = (process.env.GOOGLE_CALENDAR_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

let token: { value: string; expiresAt: number } | undefined;
let cache: { key: string; busy: BusyInterval[]; expiresAt: number } | undefined;

async function loadKey(): Promise<ServiceAccountKey | null> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  try {
    const file = path.join(process.cwd(), ".data", "google-service-account.json");
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;

  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");

  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google token: ${body.error_description ?? body.error ?? res.status}`);
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

/** Períodos ocupados nos calendários configurados. Em caso de erro devolve [] (e regista). */
export async function getGoogleBusy(from: Date, to: Date): Promise<BusyInterval[]> {
  if (!calendarIds.length) return [];
  const cacheKey = `${from.toISOString().slice(0, 13)}|${to.toISOString().slice(0, 10)}`;
  if (cache && cache.key === cacheKey && cache.expiresAt > Date.now()) return cache.busy;

  try {
    const key = await loadKey();
    if (!key) return [];
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getAccessToken(key)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      }),
      cache: "no-store",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Google FreeBusy: ${body.error?.message ?? res.status}`);

    const busy: BusyInterval[] = [];
    for (const [id, calendar] of Object.entries(body.calendars ?? {}) as [
      string,
      { busy?: { start: string; end: string }[]; errors?: { reason: string }[] },
    ][]) {
      if (calendar.errors?.length) {
        console.error(`[google-calendar] ${id}: ${calendar.errors.map((e) => e.reason).join(", ")}`);
      }
      for (const b of calendar.busy ?? []) busy.push({ start: new Date(b.start), end: new Date(b.end) });
    }
    cache = { key: cacheKey, busy, expiresAt: Date.now() + CACHE_MS };
    return busy;
  } catch (err) {
    console.error("[google-calendar]", err);
    return [];
  }
}
