import type { NextRequest } from "next/server";
import { authorizeSync, saveNutriumAgenda, type NutriumAppointment } from "@/lib/nutrium-sync";

const MAX_APPOINTMENTS = 3000;
const MAX_RANGE_DAYS = 400;

/** A extensão envia a agenda do Nutrium que leu (para o backoffice a mostrar junto com o Cal.com). */
export async function POST(request: NextRequest) {
  const denied = await authorizeSync(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const from = new Date(body?.from);
  const to = new Date(body?.to);
  const list: unknown = body?.appointments;
  if (
    !from.getTime() ||
    !to.getTime() ||
    to <= from ||
    to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86400000 ||
    !Array.isArray(list) ||
    list.length > MAX_APPOINTMENTS
  ) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const appointments: NutriumAppointment[] = [];
  for (const a of list) {
    const start = new Date(a?.start);
    const end = new Date(a?.end);
    if (typeof a?.id !== "string" || !a.id || a.id.length > 50 || !start.getTime() || !end.getTime()) continue;
    appointments.push({
      id: a.id,
      start: start.toISOString(),
      end: end.toISOString(),
      nome: String(a.nome ?? "").slice(0, 200),
      status: [0, 1, 2].includes(a.status) ? a.status : 1,
    });
  }

  await saveNutriumAgenda(from, to, appointments);
  return Response.json({ ok: true, saved: appointments.length });
}
