"use server";

import { headers } from "next/headers";
import { PaymentError, startPayment } from "@/lib/payments";
import { EupagoConfigError, EupagoError } from "@/lib/payments/eupago";
import { clientIp, hitLimit } from "@/lib/rate-limit";

export async function startPaymentAction(uid: string, method: "mbway" | "multibanco", phone: string) {
  if (await hitLimit("pagamento-iniciar", clientIp(await headers()), 10, 15 * 60)) {
    return "Demasiadas tentativas. Tenta de novo daqui a pouco.";
  }
  try {
    await startPayment(uid, method, phone);
    return null;
  } catch (err) {
    if (err instanceof PaymentError) return err.message;
    console.error("[pagamento]", err);
    if (err instanceof EupagoConfigError) {
      return "Os pagamentos online ainda não estão disponíveis. Contacta-nos para concluir a marcação.";
    }
    return err instanceof EupagoError
      ? "A EuPago não aceitou o pedido. Confirma o número ou tenta outro método."
      : "Não foi possível iniciar o pagamento. Tenta de novo daqui a pouco.";
  }
}
