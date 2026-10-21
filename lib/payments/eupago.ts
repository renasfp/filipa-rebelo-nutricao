import "server-only";
import { createDecipheriv, createHmac, timingSafeEqual } from "crypto";

// Cliente da EuPago (docs.eupago.pt). EUPAGO_API_KEY: chave do canal; EUPAGO_ENV: "sandbox",
// "production" ou o URL base; EUPAGO_WEBHOOK_KEY: chave criptográfica do canal (Webhooks 2.0).

function baseUrl() {
  const env = process.env.EUPAGO_ENV ?? "sandbox";
  if (env.startsWith("http")) return env.replace(/\/$/, "");
  return env === "production" ? "https://clientes.eupago.pt" : "https://sandbox.eupago.pt";
}

function apiKey() {
  const key = process.env.EUPAGO_API_KEY;
  if (!key) throw new EupagoConfigError("EUPAGO_API_KEY não está configurada.");
  return key;
}

export class EupagoError extends Error {}
/** Falta configuração no servidor (não é culpa da cliente nem da EuPago). */
export class EupagoConfigError extends EupagoError {}

async function post<T>(path: string, body: object, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new EupagoError(`EuPago ${path}: ${data?.text ?? data?.resposta ?? data?.message ?? res.status}`);
  }
  return data as T;
}

const euros = (cents: number) => Number((cents / 100).toFixed(2));

/** Pedido MB WAY: a cliente tem ~5 minutos para aprovar na app. */
export async function createMbway(identifier: string, amountCents: number, phone: string) {
  const data = await post<{ transactionStatus: string; transactionID?: string; reference?: string; text?: string }>(
    "/api/v1.02/mbway/create",
    {
      payment: {
        identifier,
        amount: { value: euros(amountCents), currency: "EUR" },
        customerPhone: phone,
        countryCode: "+351",
      },
    },
    { Authorization: `ApiKey ${apiKey()}` },
  );
  if (data.transactionStatus !== "Success" || !data.transactionID) {
    throw new EupagoError(`MB WAY recusado: ${data.text ?? data.transactionStatus}`);
  }
  return { transactionId: data.transactionID, reference: data.reference ?? null };
}

/** Referência Multibanco pagável até ao fim do dia `deadline` (YYYY-MM-DD). */
export async function createMultibanco(identifier: string, amountCents: number, deadline: string) {
  const data = await post<{ sucesso: boolean; resposta?: string; entidade?: string; referencia?: string }>(
    "/clientes/rest_api/multibanco/create",
    { chave: apiKey(), valor: euros(amountCents).toFixed(2), id: identifier, per_dup: "0", data_fim: deadline },
  );
  if (!data.sucesso || !data.entidade || !data.referencia) {
    throw new EupagoError(`Multibanco recusado: ${data.resposta ?? "erro"}`);
  }
  return { entity: data.entidade, reference: data.referencia };
}

// ─── Webhooks 2.0 ───────────────────────────────

export interface EupagoWebhookTransaction {
  trid?: number | string;
  identifier?: string;
  reference?: number | string;
  entity?: number | string;
  method?: string;
  amount?: { value?: number | string; amount?: number | string; currency?: string } | number | string;
  date?: string;
  status?: string;
}

function webhookKey() {
  const key = process.env.EUPAGO_WEBHOOK_KEY;
  if (!key) throw new EupagoConfigError("EUPAGO_WEBHOOK_KEY não está configurada.");
  return key;
}

function sameSignature(data: string, signature: string, key: string) {
  const expected = createHmac("sha256", key).update(data).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Valida a assinatura (X-Signature: HMAC-SHA256 em base64 com a chave do canal) e devolve o
 * conteúdo, decifrado se o canal cifrar (AES-256-CBC, IV no X-Initialization-Vector).
 * A documentação não diz se a assinatura cobre o corpo ou o texto decifrado; aceitamos ambos.
 */
export function readWebhook(rawBody: string, signature: string | null, iv: string | null): unknown {
  const key = webhookKey();
  if (!signature) throw new EupagoError("Webhook sem assinatura.");
  let body: { data?: string } & Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new EupagoError("Webhook com JSON inválido.");
  }

  let plain: string | null = null;
  if (iv && typeof body.data === "string") {
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(key, "utf8").subarray(0, 32), Buffer.from(iv, "base64"));
    plain = Buffer.concat([decipher.update(Buffer.from(body.data, "base64")), decipher.final()]).toString("utf8");
  }
  const valid = sameSignature(rawBody, signature, key) || (plain !== null && sameSignature(plain, signature, key));
  if (!valid) throw new EupagoError("Assinatura do webhook inválida.");
  return plain !== null ? JSON.parse(plain) : body;
}
