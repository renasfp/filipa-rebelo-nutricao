import { formatDateLong } from "./time";
import type { BookingRequest } from "./types";

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Envia o aviso de novo pedido via Resend. Sem RESEND_API_KEY, apenas regista na consola. */
export async function sendNewRequestEmail(to: string, request: BookingRequest, adminUrl: string) {
  const subject = `Novo pedido de consulta · ${request.name} · ${request.date} ${request.time}`;
  const rows: [string, string][] = [
    ["Nome", request.name],
    ["Email", request.email],
    ["Telefone", request.phone],
    ["Local", request.locationName],
    ["Data", formatDateLong(request.date)],
    ["Hora", request.time],
    ["Notas", request.notes || "—"],
  ];
  const html = `
    <h2 style="font-family:Georgia,serif;font-weight:400">Novo pedido de consulta</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
      ${rows.map(([k, v]) => `<tr><td style="color:#6B6560">${k}</td><td>${escape(v)}</td></tr>`).join("")}
    </table>
    <p style="font-family:Arial,sans-serif;font-size:14px">
      <a href="${escape(adminUrl)}">Ver pedidos no painel</a>
    </p>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[email] (RESEND_API_KEY não definida) Para: ${to} · ${subject}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.BOOKING_FROM_EMAIL ?? "Marcações <onboarding@resend.dev>",
      to,
      reply_to: request.email,
      subject,
      html,
    }),
  });
  if (!res.ok) console.error(`[email] Falha ao enviar: ${res.status} ${await res.text()}`);
}
