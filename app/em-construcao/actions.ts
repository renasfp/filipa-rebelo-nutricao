"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteKey, getCounter, incrementCounter } from "@/lib/booking/store";
import {
  checkSitePassword,
  safeNextPath,
  SITE_ACCESS_COOKIE,
  SITE_ACCESS_MAX_AGE,
  siteAccessToken,
} from "@/lib/site-access";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

export async function enterSite(_prev: string | null, formData: FormData): Promise<string | null> {
  const token = siteAccessToken();
  if (!token) redirect("/");

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "desconhecido";
  const key = `site-fails:${ip}`;
  const blocked = `Demasiadas tentativas falhadas. Tente de novo daqui a ${WINDOW_SECONDS / 60} minutos.`;

  if ((await getCounter(key)) >= MAX_ATTEMPTS) return blocked;
  if (!checkSitePassword(String(formData.get("password") ?? ""))) {
    const fails = await incrementCounter(key, WINDOW_SECONDS);
    const left = MAX_ATTEMPTS - fails;
    return left > 0 ? `Palavra-passe incorreta. Restam ${left} tentativa${left === 1 ? "" : "s"}.` : blocked;
  }

  await deleteKey(key);
  (await cookies()).set(SITE_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_ACCESS_MAX_AGE,
  });
  redirect(safeNextPath(formData.get("next")));
}
