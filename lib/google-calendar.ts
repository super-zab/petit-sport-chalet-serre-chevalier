import { google } from "googleapis";
import { getGoogleCredentials } from "@/lib/google-credentials";

export interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

export async function createCalendarEvent(
  event: CalendarEvent,
  calendarId: string
): Promise<string> {
  const credentials = getGoogleCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    if (!response.data.id) {
      throw new Error("Failed to create calendar event: no event ID returned");
    }

    return response.data.id;
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(`Calendrier introuvable. Vérifiez que le Calendar ID "${calendarId}" est correct et que le Service Account a accès à ce calendrier.`);
    } else if (error.code === 403) {
      throw new Error(`Permission refusée. Vérifiez que le Service Account a les droits "Make changes to events" sur le calendrier "${calendarId}".`);
    } else {
      throw new Error(`Erreur Google Calendar: ${error.message || "Erreur inconnue"}`);
    }
  }
}

export async function updateCalendarEvent(
  eventId: string,
  calendarId: string,
  updates: Partial<CalendarEvent>
): Promise<void> {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: updates,
  });
}

export async function deleteCalendarEvent(
  eventId: string,
  calendarId: string
): Promise<void> {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

export interface OccupiedDate {
  start: Date;
  end: Date;
}

/**
 * Récupère la liste des jours occupés (YYYY-MM-DD) pour un calendrier.
 * Convention : "réservé du 11 au 13" = client arrive le 11, part le 13 → on grise les cases 11 et 12.
 * - Événements jour entier (date) : Google renvoie end exclusive → on grise [start, end[.
 * - Événements avec heure (dateTime) : on utilise le jour civil en Europe/Paris pour start/end, puis [start, end[.
 */
export async function getOccupiedDays(
  calendarId: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<string[]> {
  const credentials = getGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin?.toISOString(),
      timeMax: timeMax?.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];
    const occupiedSet = new Set<string>();

    for (const event of events) {
      const summary = (event.summary || "").trim();
      // Ne compter QUE les séjours validés ; ignorer [PROVISOIRE] et tout autre événement.
      if (!summary.startsWith("[Sejour validé")) {
        continue;
      }

      if (!event.start || !event.end) continue;

      /**
       * 1) Récupérer les bornes de l’intervalle [start, end) telles que stockées par Google.
       *
       * - Pour les événements all‑day (recommandés pour les séjours) :
       *   start.date = jour d’arrivée (inclus)
       *   end.date   = jour de départ (EXCLUSIF)
       *   → Intervalle naturel [start.date, end.date)
       *
       * - Pour les événements avec heures (dateTime) :
       *   on projette en jour civil Europe/Paris puis on applique la même règle [start, end).
       */
      let startStr: string | undefined;
      let endStr: string | undefined;

      if (event.start.date && event.end.date) {
        // All‑day : Google fournit déjà des YYYY‑MM‑DD corrects et end EXCLUSIF.
        startStr = (event.start.date as string).slice(0, 10);
        endStr = (event.end.date as string).slice(0, 10);
      } else if (event.start.dateTime && event.end.dateTime) {
        const tz = "Europe/Paris";
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);

        startStr = startDate.toLocaleDateString("en-CA", { timeZone: tz });
        endStr = endDate.toLocaleDateString("en-CA", { timeZone: tz });
      }

      if (!startStr || !endStr) continue;

      /**
       * 2) Étendre l’intervalle jour par jour en respectant strictement [start, end)
       *
       * Exemple : start=2026‑02‑11, end=2026‑02‑13
       *   → jours occupés = 2026‑02‑11 et 2026‑02‑12
       *   → 13 est libre (jour de départ).
       */
      for (
        let d = new Date(startStr + "T00:00:00Z");
        d.toISOString().slice(0, 10) < endStr;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        occupiedSet.add(d.toISOString().slice(0, 10));
      }
    }

    return Array.from(occupiedSet);
  } catch (error: any) {
    console.error("[Google Calendar] Error fetching occupied dates:", error);
    if (error.code === 404) {
      throw new Error(`Calendrier introuvable. Vérifiez que le Calendar ID "${calendarId}" est correct.`);
    } else if (error.code === 403) {
      throw new Error(`Permission refusée. Vérifiez que le Service Account a les droits de lecture sur le calendrier "${calendarId}".`);
    } else {
      throw new Error(`Erreur Google Calendar: ${error.message || "Erreur inconnue"}`);
    }
  }
}

/** @deprecated Utiliser getOccupiedDays pour une comparaison fiable. */
export async function getOccupiedDates(
  calendarId: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<OccupiedDate[]> {
  const days = await getOccupiedDays(calendarId, timeMin, timeMax);
  return days.map((d) => {
    const start = new Date(d + "T00:00:00");
    const end = new Date(d + "T23:59:59");
    return { start, end };
  });
}
