/** 0 = domingo … 6 = sábado (como Date.getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayHours = { start: string; end: string } | null;

export interface Location {
  id: string;
  name: string;
  address: string;
  online: boolean;
  /** Dias da semana em que este local aceita consultas. */
  weekdays: Weekday[];
  active: boolean;
}

export interface BookingConfig {
  /** Horário de trabalho por dia da semana, indexado por Weekday (7 entradas). */
  hours: DayHours[];
  slotMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  /** Datas sem consultas (férias, feriados), formato YYYY-MM-DD. */
  blockedDates: string[];
  notificationEmail: string;
  locations: Location[];
}

export type BookingStatus = "pendente" | "confirmado" | "recusado";

export interface BookingRequest {
  id: string;
  createdAt: string;
  status: BookingStatus;
  locationId: string;
  locationName: string;
  /** Data e hora locais (Europe/Lisbon). */
  date: string;
  time: string;
  durationMinutes: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
}

export interface Slot {
  time: string;
  /** false quando o horário já está ocupado (mostrado riscado, sem poder ser escolhido). */
  free: boolean;
}

export interface AvailableDay {
  date: string;
  slots: Slot[];
}

export const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const DEFAULT_CONFIG: BookingConfig = {
  hours: [
    null,
    { start: "13:00", end: "19:00" },
    { start: "13:00", end: "19:00" },
    { start: "13:00", end: "19:00" },
    { start: "13:00", end: "19:00" },
    { start: "13:00", end: "19:00" },
    null,
  ],
  slotMinutes: 60,
  minNoticeHours: 24,
  maxDaysAhead: 60,
  blockedDates: [],
  notificationEmail: "filipa.rebelo@live.com.pt",
  locations: [
    { id: "fisio-equilibrio", name: "Fisio Equilíbrio", address: "", online: false, weekdays: [1, 2], active: true },
    { id: "routine", name: "Routine", address: "", online: false, weekdays: [3, 4], active: true },
    { id: "pele-fresca", name: "Pele Fresca", address: "", online: false, weekdays: [5], active: true },
    { id: "online", name: "Online", address: "Videochamada", online: true, weekdays: [1, 2, 3, 4, 5], active: true },
  ],
};

const WEEKDAY_PLURALS = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

/** Ex.: [1,2] → "Segundas e terças"; [1..5] → "Segunda a sexta". */
export function describeWeekdays(weekdays: Weekday[]): string {
  const sorted = [...weekdays].sort();
  if (sorted.join() === "1,2,3,4,5") return "Segunda a sexta";
  const names = sorted.map((d) => WEEKDAY_PLURALS[d]);
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0] ?? "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
