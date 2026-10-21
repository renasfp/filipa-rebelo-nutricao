import type { NextRequest } from "next/server";
import { handlePaymentEvent } from "@/lib/payments";
import { EupagoError, readWebhook, type EupagoWebhookTransaction } from "@/lib/payments/eupago";
import { clientIp, countFailure, overLimit, tooManyRequests } from "@/lib/rate-limit";

// Webhooks 2.0 da EuPago. Fora da proteção "em construção" (ver proxy.ts): a autenticação é a
// assinatura HMAC com a chave do canal. Responder 200 só depois de processar (a EuPago repete).

export async function POST(request: NextRequest) {
  if (!process.env.EUPAGO_WEBHOOK_KEY) return Response.json({ error: "Webhook não configurado" }, { status: 503 });
  const ip = clientIp(request.headers);
  if (await overLimit("eupago-webhook", ip, 20)) return tooManyRequests();

  const raw = await request.text();
  let payload: { transactions?: EupagoWebhookTransaction | EupagoWebhookTransaction[] };
  try {
    payload = readWebhook(raw, request.headers.get("x-signature"), request.headers.get("x-initialization-vector")) as typeof payload;
  } catch (err) {
    console.warn("[eupago/webhook]", (err as Error).message);
    await countFailure("eupago-webhook", ip, 15 * 60);
    return Response.json({ error: err instanceof EupagoError ? err.message : "Pedido inválido" }, { status: 401 });
  }

  const transactions = [payload.transactions ?? []].flat();
  try {
    for (const tx of transactions) {
      const outcome = await handlePaymentEvent(tx);
      console.info(`[eupago/webhook] ${tx.status} ${tx.identifier} → ${outcome}`);
    }
  } catch (err) {
    console.error("[eupago/webhook]", err);
    return Response.json({ error: "Erro ao processar" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
