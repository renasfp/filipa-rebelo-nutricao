import type { NextRequest } from "next/server";
import { getAvailability } from "@/lib/booking/availability";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("local") ?? "";
  const result = await getAvailability(locationId);
  if (!result) return Response.json({ error: "Local inválido" }, { status: 404 });
  return Response.json({ days: result.days, slotMinutes: result.config.slotMinutes });
}
