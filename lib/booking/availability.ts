import { getFreeSlots, getSchedule, listEventTypes, type CalEventType, type CalSchedule } from "./calcom";
import { addDays, lisbonToUtc, minutesToTime, TIMEZONE, timeToMinutes, todayInLisbon, weekdayOf } from "./time";
import type { AvailableDay, Location, Weekday } from "./types";

// O Cal.com é a agenda: só devolve os horários livres. Para mostrar também os ocupados (riscados),
// geramos a grelha a partir do horário de trabalho do tipo de evento e marcamos como ocupado
// tudo o que o Cal.com não devolveu como livre.

const DEFAULT_WINDOW_DAYS = 60;
const MAX_WINDOW_DAYS = 365;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function scheduleFor(type: CalEventType): Promise<CalSchedule | null> {
  try {
    const schedule = await getSchedule(type.scheduleId);
    if (schedule && schedule.timeZone !== TIMEZONE) {
      console.warn(`[cal.com] horário de "${type.slug}" está em ${schedule.timeZone}; ocupados não serão mostrados.`);
      return null;
    }
    return schedule;
  } catch (err) {
    console.error("[cal.com]", err);
    return null;
  }
}

function toLocation(type: CalEventType, schedule: CalSchedule | null): Location {
  const address = type.locations.find((l) => l.type === "address" && l.public !== false)?.address ?? "";
  const online = type.locations.some((l) => l.type !== "address");
  const weekdays = new Set<Weekday>();
  for (const a of schedule?.availability ?? []) {
    for (const day of a.days) weekdays.add(DAY_NAMES.indexOf(day) as Weekday);
  }
  return {
    id: type.slug,
    eventTypeId: type.id,
    name: type.title,
    lengthInMinutes: type.lengthInMinutes,
    address: online && !address ? "Videochamada" : address,
    online,
    weekdays: [...weekdays].filter((d) => d >= 0).sort(),
  };
}

export async function getLocations(): Promise<Location[]> {
  const types = await listEventTypes();
  return Promise.all(types.map(async (t) => toLocation(t, await scheduleFor(t))));
}

/** Último dia (YYYY-MM-DD) em que o tipo de evento aceita marcações. */
function lastBookableDate(type: CalEventType, today: string): string {
  const window = Array.isArray(type.bookingWindow) ? type.bookingWindow[0] : type.bookingWindow;
  const max = addDays(today, MAX_WINDOW_DAYS);
  let last = addDays(today, DEFAULT_WINDOW_DAYS);
  if (window?.type === "range") {
    last = window.value[1];
  } else if (window?.type === "calendarDays") {
    last = addDays(today, window.value);
  } else if (window?.type === "businessDays") {
    last = today;
    for (let count = 0; count < window.value; ) {
      last = addDays(last, 1);
      if (weekdayOf(last) % 6 !== 0) count++;
    }
  }
  return last < max ? last : max;
}

/** Inícios de consulta ("HH:MM") previstos pelo horário de trabalho nesse dia. */
function workingTimes(schedule: CalSchedule, date: string, length: number, step: number): string[] {
  const overrides = schedule.overrides.filter((o) => o.date === date);
  const ranges = overrides.length
    ? overrides
    : schedule.availability.filter((a) => a.days.includes(DAY_NAMES[weekdayOf(date)]));
  const times: string[] = [];
  for (const r of ranges) {
    const end = timeToMinutes(r.endTime);
    for (let t = timeToMinutes(r.startTime); t + length <= end; t += step) times.push(minutesToTime(t));
  }
  return times;
}

export async function getAvailability(locationId: string) {
  const type = (await listEventTypes()).find((t) => t.slug === locationId);
  if (!type) return null;

  const now = new Date();
  const today = todayInLisbon(now);
  const last = lastBookableDate(type, today);
  const [free, schedule] = await Promise.all([getFreeSlots(type.id, today, last), scheduleFor(type)]);

  const earliest = now.getTime() + (type.minimumBookingNotice ?? 0) * 60000;
  const step = type.slotInterval || type.lengthInMinutes;
  const days: AvailableDay[] = [];

  for (let date = today; date <= last; date = addDays(date, 1)) {
    const freeTimes = new Set(free.get(date) ?? []);
    const times = new Set(freeTimes);
    if (schedule) {
      for (const time of workingTimes(schedule, date, type.lengthInMinutes, step)) {
        if (lisbonToUtc(date, time).getTime() >= earliest) times.add(time);
      }
    }
    const slots = [...times].sort().map((time) => ({ time, free: freeTimes.has(time) }));
    if (slots.length) days.push({ date, slots });
  }

  return { type, days };
}

/** Confirma no Cal.com, no momento da marcação, que o horário continua livre. */
export async function isSlotFree(type: CalEventType, date: string, time: string) {
  return (await getFreeSlots(type.id, date, date)).get(date)?.includes(time) ?? false;
}
