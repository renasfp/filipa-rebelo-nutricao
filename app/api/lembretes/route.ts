import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { runReminders } from "@/lib/reminders";

// Chamado de hora a hora por um cron externo (ex.: cron-job.org; o cron da Vercel no plano
// gratuito só corre uma vez por dia), com o cabeçalho Authorization: Bearer <CRON_SECRET>.

function authorized(header: string | null) {
  const expected = process.env.CRON_SECRET;
  const given = header?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !given) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

export async function GET(request: NextRequest) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    return Response.json(await runReminders());
  } catch (err) {
    console.error("[lembretes]", err);
    return Response.json({ error: "Falha ao processar os lembretes" }, { status: 500 });
  }
}
