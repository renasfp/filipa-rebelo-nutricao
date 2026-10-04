"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { getAvailability } from "@/lib/booking/availability";
import { sendNewRequestEmail } from "@/lib/booking/email";
import { saveRequest } from "@/lib/booking/store";
import type { BookingRequest } from "@/lib/booking/types";

export interface BookingFormState {
  status: "idle" | "success" | "error" | "slot-taken";
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!name || !EMAIL_RE.test(email) || phone.replace(/\D/g, "").length < 9) {
    return { status: "error", message: "Preenche o nome, um email válido e o telefone." };
  }
  if (!formData.get("consent")) {
    return { status: "error", message: "É necessário aceitar o tratamento dos dados." };
  }

  const availability = await getAvailability(locationId);
  if (!availability) return { status: "error", message: "Local inválido." };
  const stillFree = availability.days.some((d) => d.date === date && d.slots.includes(time));
  if (!stillFree) {
    return {
      status: "slot-taken",
      message: "Esse horário acabou de ficar indisponível. Escolhe outro, por favor.",
    };
  }

  const request: BookingRequest = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pendente",
    locationId,
    locationName: availability.location.name,
    date,
    time,
    durationMinutes: availability.config.slotMinutes,
    name,
    email,
    phone,
    notes,
  };
  await saveRequest(request);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  await sendNewRequestEmail(availability.config.notificationEmail, request, `${origin}/admin`);

  return { status: "success" };
}
