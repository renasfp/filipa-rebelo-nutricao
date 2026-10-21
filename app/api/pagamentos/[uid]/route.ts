import type { NextRequest } from "next/server";
import { paymentPageState } from "@/lib/payments";
import { clientIp, hitLimit, tooManyRequests } from "@/lib/rate-limit";

/** Estado do pagamento de uma marcação, consultado pela página de pagamento (o uid não é adivinhável). */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/pagamentos/[uid]">) {
  if (await hitLimit("pagamento-estado", clientIp(request.headers), 60, 60)) return tooManyRequests();
  const { uid } = await params;
  const state = await paymentPageState(uid).catch(() => null);
  if (!state) return Response.json({ error: "Marcação não encontrada" }, { status: 404 });
  return Response.json({
    bookingStatus: state.booking.status,
    paid: state.paid,
    open: state.open && { method: state.open.method, expiresAt: state.open.expiresAt },
    last: state.payments[0] && { method: state.payments[0].method, status: state.payments[0].status },
  });
}
