import type { NextRequest } from "next/server";
import { authorizeSync, listSyncBookings, markSynced } from "@/lib/nutrium-sync";

// Usado pela extensão do Chrome (pasta extension/). Fora da proteção "em construção" (ver proxy.ts),
// por isso exige sempre o token.

export async function GET(request: NextRequest) {
  const denied = await authorizeSync(request);
  if (denied) return denied;
  try {
    return Response.json({ bookings: await listSyncBookings() });
  } catch (err) {
    console.error("[nutrium]", err);
    return Response.json({ error: "Não foi possível ler as marcações do Cal.com" }, { status: 502 });
  }
}

/** Regista que a marcação `uid` (na versão `version`) já está no Nutrium (consulta `nutriumId`, cliente `patientId`). */
export async function POST(request: NextRequest) {
  const denied = await authorizeSync(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const { uid, nutriumId, patientId, version } = body ?? {};
  if (![uid, nutriumId, patientId, version].every((v) => typeof v === "string" && v && v.length <= 200)) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }
  await markSynced(uid, { nutriumId, patientId, version });
  return Response.json({ ok: true });
}
