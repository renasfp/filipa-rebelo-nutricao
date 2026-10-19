import type { NextRequest } from "next/server";
import { authorizeSync } from "@/lib/nutrium-sync";
import { reminderLog, reminderMode } from "@/lib/reminders";

/** Últimos lembretes enviados ou simulados, com o token da extensão do Chrome. */
export async function GET(request: NextRequest) {
  const denied = await authorizeSync(request);
  if (denied) return denied;
  return Response.json({ mode: reminderMode(), log: await reminderLog() });
}
