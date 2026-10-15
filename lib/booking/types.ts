/** 0 = domingo … 6 = sábado (como Date.getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Campo personalizado do formulário de marcação, definido no tipo de evento do Cal.com. */
export interface BookingField {
  slug: string;
  type: "text" | "number" | "textarea" | "radio" | "select" | "checkbox" | "boolean";
  label: string;
  required: boolean;
  options: string[];
}

/** Um tipo de consulta corresponde a um tipo de evento (visível) no Cal.com. */
export interface Location {
  /** Slug do tipo de evento no Cal.com. */
  id: string;
  eventTypeId: number;
  name: string;
  lengthInMinutes: number;
  /** Só preenchida quando a morada é pública no Cal.com. */
  address: string;
  online: boolean;
  /** Dias da semana com horário de trabalho (vazio se o horário não puder ser lido). */
  weekdays: Weekday[];
  fields: BookingField[];
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

const WEEKDAY_PLURALS = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

/** Ex.: [1,2] → "Segundas e terças"; [1..5] → "Segunda a sexta". */
export function describeWeekdays(weekdays: Weekday[]): string {
  const sorted = [...weekdays].sort();
  if (sorted.join() === "1,2,3,4,5") return "Segunda a sexta";
  const names = sorted.map((d) => WEEKDAY_PLURALS[d]);
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0] ?? "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
