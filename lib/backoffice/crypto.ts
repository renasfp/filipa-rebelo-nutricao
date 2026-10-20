import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Primitivas de segurança do backoffice: palavras-passe (scrypt), TOTP (RFC 6238, como o
// Google Authenticator) e cifra do segredo TOTP (AES-256-GCM com BACKOFFICE_SECRET).

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, {
    ...SCRYPT,
    N: Number(n),
  });
  return timingSafeEqual(actual, expected);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Palavra-passe temporária legível (sem caracteres ambíguos). */
export function temporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join("");
}

// ─── Cifra do segredo TOTP ───────────────────────────────

function key() {
  const secret = process.env.BACKOFFICE_SECRET;
  if (!secret || secret.length < 32) throw new Error("BACKOFFICE_SECRET em falta (mínimo 32 caracteres).");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(sealed: string) {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ─── TOTP (RFC 6238: SHA-1, 6 dígitos, passos de 30 s) ───────────────

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret() {
  let bits = "";
  for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, "0");
  return bits.match(/.{1,5}/g)!.map((chunk) => BASE32[parseInt(chunk.padEnd(5, "0"), 2)]).join("");
}

function base32Decode(secret: string) {
  const bits = [...secret.replace(/=+$/, "").toUpperCase()]
    .map((c) => BASE32.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 30_000);

/**
 * Verifica o código (aceita ±1 passo de relógio) e devolve o passo usado, ou null.
 * Recusa passos iguais ou anteriores a `lastStep` para o mesmo código não servir duas vezes.
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()) {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  for (const delta of [0, -1, 1]) {
    const step = currentStep(now) + delta;
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(clean))) return step;
  }
  return null;
}

export function totpUri(secret: string, email: string) {
  const label = encodeURIComponent(`Filipa Rebelo Backoffice:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Filipa Rebelo Backoffice")}&digits=6&period=30`;
}
