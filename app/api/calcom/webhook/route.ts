import type { NextRequest } from "next/server";
import { recentEvents, recordEvent, verifySignature, type CalWebhookEvent } from "@/lib/calcom-webhook";
import { authorizeSync } from "@/lib/nutrium-sync";
import { clientIp, countFailure, overLimit, tooManyRequests } from "@/lib/rate-limit";

// Recebe os webhooks do Cal.com. Fora da proteção "em construção" (ver proxy.ts): a autenticação
// é a assinatura HMAC do corpo.

export async function POST(request: NextRequest) {
  if (!process.env.CALCOM_WEBHOOK_SECRET) {
    return Response.json({ error: "Webhook não configurado" }, { status: 503 });
  }
  const ip = clientIp(request.headers);
  if (await overLimit("webhook", ip, 20)) return tooManyRequests();
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-cal-signature-256"))) {
    console.warn("[calcom/webhook] assinatura inválida");
    await countFailure("webhook", ip, 15 * 60);
    return Response.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let event: CalWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof event?.triggerEvent !== "string") {
    return Response.json({ error: "Evento inválido" }, { status: 400 });
  }

  const fresh = await recordEvent(event);
  console.info(`[calcom/webhook] ${event.triggerEvent} ${event.payload?.uid ?? ""}${fresh ? "" : " (repetido)"}`);
  return Response.json({ ok: true, duplicate: !fresh });
}

/** Últimos eventos recebidos (para diagnóstico), com o mesmo token da extensão do Chrome. */
export async function GET(request: NextRequest) {
  const denied = await authorizeSync(request);
  if (denied) return denied;
  return Response.json({ events: await recentEvents() });
}
