// Todas as datas/horas de consulta são "hora de Lisboa". O servidor (Vercel) corre em UTC,
// por isso convertemos explicitamente sempre que comparamos com instantes reais.

export const TIMEZONE = "Europe/Lisbon";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Diferença (minutos) entre a hora de Lisboa e UTC no instante dado. */
function offsetMinutes(instant: Date): number {
  const p = Object.fromEntries(
    partsFormatter.formatToParts(instant).map((x) => [x.type, Number(x.value)]),
  );
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Converte "YYYY-MM-DD" + "HH:MM" em Lisboa para o instante UTC correspondente. */
export function lisbonToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ts = guess - offsetMinutes(new Date(guess)) * 60000;
  // Corrige perto da mudança de hora.
  ts = guess - offsetMinutes(new Date(ts)) * 60000;
  return new Date(ts);
}

/** Data de hoje em Lisboa, "YYYY-MM-DD". */
export function todayInLisbon(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-PT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
