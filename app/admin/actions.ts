"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/auth";
import {
  deleteKey,
  getCounter,
  getRequest,
  incrementCounter,
  saveConfig,
  saveRequest,
} from "@/lib/booking/store";
import { timeToMinutes } from "@/lib/booking/time";
import type { BookingConfig, BookingStatus, Weekday } from "@/lib/booking/types";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  if (!process.env.ADMIN_PASSWORD) return "ADMIN_PASSWORD não está configurada no servidor.";

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "desconhecido";
  const key = `login-fails:${ip}`;
  const blocked = `Demasiadas tentativas falhadas. Tenta de novo daqui a ${LOGIN_WINDOW_SECONDS / 60} minutos.`;

  if ((await getCounter(key)) >= MAX_LOGIN_ATTEMPTS) return blocked;
  if (!checkPassword(String(formData.get("password") ?? ""))) {
    const fails = await incrementCounter(key, LOGIN_WINDOW_SECONDS);
    const left = MAX_LOGIN_ATTEMPTS - fails;
    return left > 0 ? `Palavra-passe incorreta. Restam ${left} tentativa${left === 1 ? "" : "s"}.` : blocked;
  }

  await deleteKey(key);
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

const STATUSES: BookingStatus[] = ["pendente", "confirmado", "recusado"];

export async function updateRequestStatus(formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status")) as BookingStatus;
  const request = await getRequest(String(formData.get("id")));
  if (!request || !STATUSES.includes(status)) return;
  await saveRequest({ ...request, status });
  revalidatePath("/admin");
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function saveSettings(
  config: BookingConfig,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const fail = (message: string) => ({ ok: false, message });

  if (config.hours.length !== 7) return fail("Horário inválido.");
  for (const h of config.hours) {
    if (!h) continue;
    if (!TIME_RE.test(h.start) || !TIME_RE.test(h.end)) return fail("Horas em formato inválido.");
    if (timeToMinutes(h.start) >= timeToMinutes(h.end)) {
      return fail("A hora de fim tem de ser depois da hora de início.");
    }
  }
  if (!(config.slotMinutes >= 10 && config.slotMinutes <= 240)) {
    return fail("A duração da consulta deve estar entre 10 e 240 minutos.");
  }
  if (!(config.minNoticeHours >= 0 && config.minNoticeHours <= 720)) {
    return fail("Antecedência mínima inválida.");
  }
  if (!(config.maxDaysAhead >= 1 && config.maxDaysAhead <= 365)) {
    return fail("O número de dias para marcação deve estar entre 1 e 365.");
  }
  if (!EMAIL_RE.test(config.notificationEmail)) return fail("Email de notificação inválido.");
  if (!config.blockedDates.every((d) => DATE_RE.test(d))) return fail("Datas bloqueadas inválidas.");

  const ids = new Set<string>();
  const locations = [];
  for (const l of config.locations) {
    const name = l.name.trim();
    if (!name) return fail("Todos os locais precisam de um nome.");
    let id = l.id || slugify(name) || "local";
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    const weekdays = [...new Set(l.weekdays)].filter((d) => d >= 0 && d <= 6).sort() as Weekday[];
    locations.push({ id, name, address: l.address.trim(), online: !!l.online, active: !!l.active, weekdays });
  }

  await saveConfig({
    hours: config.hours.map((h) => (h ? { start: h.start, end: h.end } : null)),
    slotMinutes: Math.round(config.slotMinutes),
    minNoticeHours: Math.round(config.minNoticeHours),
    maxDaysAhead: Math.round(config.maxDaysAhead),
    blockedDates: [...new Set(config.blockedDates)].sort(),
    notificationEmail: config.notificationEmail.trim(),
    locations,
  });
  revalidatePath("/admin/definicoes");
  revalidatePath("/marcar-consulta");
  return { ok: true, message: "Definições guardadas." };
}
