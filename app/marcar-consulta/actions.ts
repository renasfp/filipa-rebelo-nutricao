"use server";

import { headers } from "next/headers";
import { customFields, getAvailability, isSlotFree } from "@/lib/booking/availability";
import { CalError, createBooking } from "@/lib/booking/calcom";
import { lisbonToUtc, todayInLisbon } from "@/lib/booking/time";
import { GENDERS } from "@/lib/booking/types";
import { priceFor } from "@/lib/payments";
import { clientIp, hitLimit } from "@/lib/rate-limit";

export interface BookingFormState {
  status: "idle" | "success" | "error" | "slot-taken";
  message?: string;
  /** Marcação criada mas a aguardar confirmação da nutricionista. */
  pending?: boolean;
  /** Página de pagamento (quando a consulta tem preço definido). */
  paymentUrl?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const SLOT_TAKEN: BookingFormState = {
  status: "slot-taken",
  message: "Esse horário acabou de ficar indisponível. Escolhe outro, por favor.",
};

/** Formato internacional exigido pelo Cal.com; números sem indicativo são tratados como portugueses. */
function internationalPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return digits.length === 9 ? `+351${digits}` : `+${digits}`;
}

export async function requestBooking(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  // Campo escondido: só bots o preenchem.
  if (field("website")) return { status: "success" };

  const locationId = field("locationId");
  const date = field("date");
  const time = field("time");
  const name = field("name").slice(0, 120);
  const email = field("email").slice(0, 200);
  const phone = field("phone").slice(0, 40);
  const notes = field("notes").slice(0, 2000);
  const birthdate = field("birthdate");
  const gender = field("gender");

  if (!name || !EMAIL_RE.test(email) || phone.replace(/\D/g, "").length < 9) {
    return { status: "error", message: "Preenche o nome, um email válido e o telefone." };
  }
  if (!DATE_RE.test(birthdate) || birthdate < "1900-01-01" || birthdate > todayInLisbon()) {
    return { status: "error", message: "Indica uma data de nascimento válida." };
  }
  if (!(GENDERS as readonly string[]).includes(gender)) {
    return { status: "error", message: "Indica o género." };
  }
  if (!formData.get("consent")) {
    return { status: "error", message: "É necessário aceitar o tratamento dos dados." };
  }
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return SLOT_TAKEN;
  if (await hitLimit("marcacao", clientIp(await headers()), 5, 15 * 60)) {
    return { status: "error", message: "Recebemos demasiados pedidos deste dispositivo. Tenta de novo mais tarde." };
  }

  try {
    const availability = await getAvailability(locationId);
    if (!availability) return { status: "error", message: "Local inválido." };

    const responses: Record<string, unknown> = {};
    for (const f of customFields(availability.type)) {
      const values = formData.getAll(`field:${f.slug}`).map((v) => String(v).trim().slice(0, 500)).filter(Boolean);
      if (f.options.length && values.some((v) => !f.options.includes(v))) {
        return { status: "error", message: `Opção inválida em "${f.label}".` };
      }
      if (f.required && !values.length) {
        return { status: "error", message: `Preenche o campo "${f.label}".` };
      }
      if (f.type === "boolean") responses[f.slug] = values.length > 0;
      else if (!values.length) continue;
      else if (f.type === "checkbox") responses[f.slug] = values;
      else if (f.type === "number") responses[f.slug] = Number(values[0]);
      else responses[f.slug] = values[0];
    }

    if (!(await isSlotFree(availability.type, date, time))) return SLOT_TAKEN;

    const price = await priceFor(availability.type.slug);
    const booking = await createBooking({
      eventTypeId: availability.type.id,
      start: lisbonToUtc(date, time),
      name,
      email,
      phoneNumber: internationalPhone(phone),
      notes,
      responses,
      birthdate,
      gender,
      reminders: formData.get("reminders") === "sim",
      requiresPayment: price !== null,
    });
    const pending = booking.status !== "accepted";
    if (pending && price !== null) {
      return { status: "success", pending, paymentUrl: `/marcar-consulta/pagamento/${booking.uid}` };
    }
    return { status: "success", pending };
  } catch (err) {
    console.error("[marcar-consulta]", err);
    // O Cal.com recusa com 4xx quando o horário deixou de estar disponível entretanto.
    if (err instanceof CalError && err.status >= 400 && err.status < 500 && /available|booked|conflict/i.test(err.message)) {
      return SLOT_TAKEN;
    }
    return {
      status: "error",
      message: "Não foi possível enviar o pedido. Tenta de novo ou contacta-me por WhatsApp.",
    };
  }
}
