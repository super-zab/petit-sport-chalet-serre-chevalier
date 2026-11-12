// Les jours sont manipulés comme des chaînes "AAAA-MM-JJ", jamais comme des objets Date locaux :
// un jour civil n'a pas de fuseau horaire, ce qui supprime les décalages d'un jour entre
// le navigateur, le serveur et la base.

export type Day = string;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function toUtcMs(day: Day): number {
  const match = DAY_RE.exec(day);
  if (!match) throw new Error(`Jour invalide : ${day}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function fromUtcMs(ms: number): Day {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Vrai pour une date réelle au format AAAA-MM-JJ (refuse le 31 février). */
export function isDay(value: unknown): value is Day {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

export function addDays(day: Day, count: number): Day {
  return fromUtcMs(toUtcMs(day) + count * MS_PER_DAY);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après `from`). */
export function diffDays(from: Day, to: Day): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** Jours de `start` inclus à `endExclusive` exclu : les nuits d'un séjour. */
export function eachDay(start: Day, endExclusive: Day): Day[] {
  const days: Day[] = [];
  for (let day = start; day < endExclusive; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Date du jour à l'heure de Paris. */
export function todayParis(now: Date = new Date()): Day {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

/** Premier jour du mois contenant `day`. */
export function monthStart(day: Day): Day {
  return `${day.slice(0, 7)}-01`;
}

export function addMonths(monthFirstDay: Day, count: number): Day {
  const year = Number(monthFirstDay.slice(0, 4));
  const month = Number(monthFirstDay.slice(5, 7)) - 1 + count;
  return fromUtcMs(Date.UTC(year, month, 1));
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayMondayFirst(day: Day): number {
  return (new Date(toUtcMs(day)).getUTCDay() + 6) % 7;
}

/**
 * Jours affichés pour un mois dans une grille lundi → dimanche,
 * complétée avec les jours des mois voisins.
 */
export function monthGrid(monthFirstDay: Day): Day[] {
  const first = monthStart(monthFirstDay);
  const gridStart = addDays(first, -weekdayMondayFirst(first));
  const lastOfMonth = addDays(addMonths(first, 1), -1);
  const gridEnd = addDays(lastOfMonth, 6 - weekdayMondayFirst(lastOfMonth));
  return eachDay(gridStart, addDays(gridEnd, 1));
}

export function formatDay(day: Day, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(new Date(toUtcMs(day)));
}

export function formatDayShort(day: Day): string {
  return formatDay(day, { weekday: "short", day: "numeric", month: "short" });
}

export function formatMonth(monthFirstDay: Day): string {
  return formatDay(monthFirstDay, { month: "long", year: "numeric" });
}

export function formatEuros(cents: number): string {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
