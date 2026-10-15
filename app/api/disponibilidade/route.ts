import type { NextRequest } from "next/server";
import { getAvailability } from "@/lib/booking/availability";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("local") ?? "";
  try {
    const result = await getAvailability(locationId);
    if (!result) return Response.json({ error: "Local inválido" }, { status: 404 });
    return Response.json({ days: result.days });
  } catch (err) {
    console.error("[disponibilidade]", err);
    return Response.json({ error: "Agenda indisponível" }, { status: 502 });
  }
}
