import type { NextRequest } from "next/server";
import { getAvailability } from "@/lib/booking/availability";
import { releaseExpiredBookings } from "@/lib/payments";
import { clientIp, hitLimit, tooManyRequests } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  if (await hitLimit("disponibilidade", clientIp(request.headers), 60, 60)) return tooManyRequests();
  const locationId = request.nextUrl.searchParams.get("local") ?? "";
  try {
    // Liberta marcações por pagar antes de calcular os horários (no máximo de 2 em 2 minutos).
    await releaseExpiredBookings().catch((err) => console.error("[pagamentos] libertar", err));
    const result = await getAvailability(locationId);
    if (!result) return Response.json({ error: "Local inválido" }, { status: 404 });
    return Response.json({ days: result.days });
  } catch (err) {
    console.error("[disponibilidade]", err);
    return Response.json({ error: "Agenda indisponível" }, { status: 502 });
  }
}
