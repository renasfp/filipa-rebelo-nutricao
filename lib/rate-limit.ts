import { getCounter, incrementCounter } from "./store";

// Limites de pedidos por IP (janela fixa, contadores no Postgres). Se a BD falhar, não bloqueia:
// é preferível deixar passar do que deitar o site abaixo.

type HeaderSource = { get(name: string): string | null };

export function clientIp(headers: HeaderSource) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "desconhecido";
}

/** Conta um pedido e devolve true se `ip` passou de `limit` pedidos em `windowSeconds`. */
export async function hitLimit(scope: string, ip: string, limit: number, windowSeconds: number) {
  try {
    return (await incrementCounter(`rl:${scope}:${ip}`, windowSeconds)) > limit;
  } catch (err) {
    console.error("[rate-limit]", err);
    return false;
  }
}

/** Para contar só falhas (ex.: token errado): verifica sem contar… */
export async function overLimit(scope: string, ip: string, limit: number) {
  try {
    return (await getCounter(`rl:${scope}:${ip}`)) >= limit;
  } catch (err) {
    console.error("[rate-limit]", err);
    return false;
  }
}

/** …e conta a falha. */
export async function countFailure(scope: string, ip: string, windowSeconds: number) {
  await hitLimit(scope, ip, Infinity, windowSeconds);
}

export const tooManyRequests = () =>
  Response.json({ error: "Demasiados pedidos. Tenta de novo daqui a pouco." }, { status: 429 });
