import type { NextRequest } from "next/server";
import { CalError } from "@/lib/booking/calcom";
import { applyFromNutrium, authorizeSync, type CalAction } from "@/lib/nutrium-sync";

const ACTIONS: CalAction[] = ["confirm", "cancel", "reschedule"];

/** A extensão pede para aplicar no Cal.com uma alteração feita no Nutrium. */
export async function POST(request: NextRequest) {
  const denied = await authorizeSync(request);
  if (denied) return denied;
  const { uid, action, start } = (await request.json().catch(() => null)) ?? {};
  const startDate = start ? new Date(start) : undefined;
  if (typeof uid !== "string" || !ACTIONS.includes(action) || (action === "reschedule" && !startDate?.getTime())) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }
  try {
    return Response.json({ booking: await applyFromNutrium(uid, action, startDate) });
  } catch (err) {
    console.error("[nutrium/acao]", err);
    if (!(err instanceof CalError)) return Response.json({ error: (err as Error).message }, { status: 400 });
    return Response.json({ error: `Cal.com: ${err.message.replace(/^Cal\.com [^:]+: /, "")}` }, { status: 502 });
  }
}
