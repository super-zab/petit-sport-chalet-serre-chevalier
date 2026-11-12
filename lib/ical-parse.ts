// Lecture et écriture du format iCalendar (RFC 5545), limité à ce qu'échangent
// Airbnb, Booking.com et Abritel : des périodes d'occupation.
// Fichier volontairement sans import : il est testé directement avec `node --test`.

export interface IcalEvent {
  uid: string;
  /** Premier jour occupé (AAAA-MM-JJ). */
  start: string;
  /** Jour de départ, exclu (AAAA-MM-JJ). */
  end: string;
  summary: string | null;
}

const MAX_EVENTS = 2000;

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Convertit une valeur DTSTART/DTEND en jour civil à Paris. */
function parseIcalDay(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, utc] = match;
  let result = `${year}-${month}-${day}`;
  if (hour !== undefined && utc) {
    const instant = new Date(`${result}T${hour}:${minute}:${second}Z`);
    if (Number.isNaN(instant.getTime())) return null;
    result = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(instant);
  }
  const check = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== result) return null;
  return result;
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

/** Extrait les périodes d'occupation d'un fichier .ics. Lève une erreur si ce n'est pas un calendrier. */
export function parseIcal(text: string): IcalEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error("Le lien ne renvoie pas un calendrier iCal.");
  }
  // Une ligne commençant par un espace ou une tabulation prolonge la précédente.
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: IcalEvent[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      if (current && current.STATUS?.toUpperCase() !== "CANCELLED") {
        const start = current.DTSTART ? parseIcalDay(current.DTSTART) : null;
        if (start) {
          let end = current.DTEND ? parseIcalDay(current.DTEND) : null;
          if (!end || end <= start) end = nextDay(start);
          const summary = current.SUMMARY ? unescapeText(current.SUMMARY).slice(0, 200) : null;
          const uid = (current.UID?.trim() || `${start}_${end}_${summary ?? ""}`).slice(0, 500);
          events.push({ uid, start, end, summary });
          if (events.length >= MAX_EVENTS) break;
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    // "DTSTART;VALUE=DATE:20260211" → nom "DTSTART", valeur "20260211".
    const name = line.slice(0, colon).split(";")[0].trim().toUpperCase();
    if (name === "DTSTART" || name === "DTEND" || name === "UID" || name === "SUMMARY" || name === "STATUS") {
      current[name] = line.slice(colon + 1);
    }
  }
  return events;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function compact(day: string): string {
  return day.replace(/-/g, "");
}

/** Produit un calendrier .ics que les autres plateformes peuvent importer. */
export function buildIcal(calendarName: string, events: IcalEvent[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Le Petit Sport Chalet//Reservations//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(event.start)}`,
      `DTEND;VALUE=DATE:${compact(event.end)}`,
      `SUMMARY:${escapeText(event.summary ?? "Réservé")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
