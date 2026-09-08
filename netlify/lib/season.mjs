/** Season + calendar helpers (America/Chicago dates as YYYY-MM-DD). */

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const DAY_THEMES = {
  Monday: "Practical",
  Tuesday: "Cozy",
  Wednesday: "Feminine",
  Thursday: "Playful",
  Friday: "Polished",
  Saturday: "Practical",
  Sunday: "Feminine",
};

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso) {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function mondayOf(d) {
  const x = startOfDay(d);
  const dow = x.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(x, offset);
}

export function firstMondayOfMonth(year, month) {
  const first = new Date(year, month - 1, 1);
  const dow = first.getDay();
  const add = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  return addDays(first, add);
}

export function seasonForDate(d) {
  const day = startOfDay(d);
  const y = day.getFullYear();
  const candidates = [
    { key: "winter", start: firstMondayOfMonth(y - 1, 12) },
    { key: "spring", start: firstMondayOfMonth(y, 3) },
    { key: "summer", start: firstMondayOfMonth(y, 6) },
    { key: "fall", start: firstMondayOfMonth(y, 9) },
    { key: "winter", start: firstMondayOfMonth(y, 12) },
    { key: "spring", start: firstMondayOfMonth(y + 1, 3) },
  ];
  for (let i = 0; i < candidates.length - 1; i++) {
    if (day >= candidates[i].start && day < candidates[i + 1].start) {
      return {
        key: candidates[i].key,
        start: candidates[i].start,
        endExclusive: candidates[i + 1].start,
      };
    }
  }
  return {
    key: "winter",
    start: firstMondayOfMonth(y, 12),
    endExclusive: firstMondayOfMonth(y + 1, 3),
  };
}

export function dayNameFromDate(d) {
  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

/** Local wall-clock parts in America/Chicago. */
export function chicagoParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    weekday: parts.weekday,
  };
}

export function daysBetween(isoA, isoB) {
  const a = parseISODate(isoA);
  const b = parseISODate(isoB);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
