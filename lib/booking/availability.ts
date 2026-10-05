import { addDays, lisbonToUtc, minutesToTime, timeToMinutes, todayInLisbon, weekdayOf } from "./time";
import { getGoogleBusy } from "./google-calendar";
import { getConfig, listRequests } from "./store";
import type { AvailableDay, BookingConfig, BookingRequest, Location, Slot } from "./types";

export interface BusyInterval {
  start: Date;
  end: Date;
}

function requestsAsBusy(requests: BookingRequest[]): BusyInterval[] {
  return requests
    .filter((r) => r.status !== "recusado")
    .map((r) => {
      const start = lisbonToUtc(r.date, r.time);
      return { start, end: new Date(start.getTime() + r.durationMinutes * 60000) };
    });
}

export function computeAvailability(
  config: BookingConfig,
  location: Location,
  busy: BusyInterval[],
  now = new Date(),
): AvailableDay[] {
  const earliest = now.getTime() + config.minNoticeHours * 3600000;
  const today = todayInLisbon(now);
  const days: AvailableDay[] = [];

  for (let i = 0; i <= config.maxDaysAhead; i++) {
    const date = addDays(today, i);
    if (config.blockedDates.includes(date)) continue;
    const weekday = weekdayOf(date);
    const hours = config.hours[weekday];
    if (!hours || !location.weekdays.includes(weekday as Location["weekdays"][number])) continue;

    const slots: Slot[] = [];
    const end = timeToMinutes(hours.end);
    for (let t = timeToMinutes(hours.start); t + config.slotMinutes <= end; t += config.slotMinutes) {
      const time = minutesToTime(t);
      const start = lisbonToUtc(date, time).getTime();
      const finish = start + config.slotMinutes * 60000;
      if (start < earliest) continue;
      const taken = busy.some((b) => start < b.end.getTime() && finish > b.start.getTime());
      slots.push({ time, free: !taken });
    }
    if (slots.length) days.push({ date, slots });
  }
  return days;
}

export async function getAvailability(locationId: string) {
  const config = await getConfig();
  const location = config.locations.find((l) => l.id === locationId && l.active);
  if (!location) return null;

  const now = new Date();
  const horizon = lisbonToUtc(addDays(todayInLisbon(now), config.maxDaysAhead + 1), "00:00");
  const [requests, external] = await Promise.all([listRequests(), getGoogleBusy(now, horizon)]);
  const busy = [...requestsAsBusy(requests), ...external];

  return { config, location, days: computeAvailability(config, location, busy, now) };
}
