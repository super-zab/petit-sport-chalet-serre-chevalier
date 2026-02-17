import { NextRequest, NextResponse } from "next/server";
import { createCalendarEvent, getOccupiedDays } from "@/lib/google-calendar";
import { getGoogleCredentials } from "@/lib/google-credentials";
import { z } from "zod";

const bookingSchema = z.object({
  apartmentId: z.string(),
  apartmentSlug: z.string(),
  apartmentName: z.string(),
  calendarId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  guests: z.string().min(1),
  totalPrice: z.number(),
});

const TZ = "Europe/Paris";

/** Extrait le jour civil YYYY-MM-DD en Europe/Paris (même convention que getOccupiedDays). */
function toDateOnlyParis(isoOrDateStr: string): string {
  const d = new Date(isoOrDateStr);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Génère les jours (YYYY-MM-DD Paris) demandés : nuits du séjour, end exclusif (jour de départ non inclus). */
function daysInRange(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const startStr = toDateOnlyParis(startISO);
  const endStr = toDateOnlyParis(endISO);
  const start = new Date(startStr + "T12:00:00Z");
  const end = new Date(endStr + "T12:00:00Z");
  for (let d = new Date(start); d.getTime() < end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = bookingSchema.parse(body);

    const calendarId = data.calendarId;
    if (!calendarId || calendarId.trim() === "") {
      return NextResponse.json(
        { error: "Calendar ID is missing for this apartment" },
        { status: 400 }
      );
    }

    // Vérifier les credentials Google
    try {
      getGoogleCredentials();
    } catch {
      console.error("Google Calendar credentials missing");
      return NextResponse.json(
        { error: "Configuration serveur incomplète" },
        { status: 500 }
      );
    }

    // Vérifier qu'aucun jour de la plage n'est déjà occupé (uniquement événements [Sejour validé], même décalage que le calendrier)
    try {
      const requestedDays = daysInRange(data.startDate, data.endDate);
      const timeMin = new Date(data.startDate);
      const timeMax = new Date(data.endDate);
      timeMax.setDate(timeMax.getDate() + 1);
      const occupied = await getOccupiedDays(calendarId, timeMin, timeMax); // ne compte que [Sejour validé], jour de départ exclu
      const occupiedSet = new Set(occupied);
      const conflicting = requestedDays.filter((d) => occupiedSet.has(d));
      if (conflicting.length > 0) {
        return NextResponse.json(
          {
            error: "Ces dates ne sont plus disponibles. Un ou plusieurs jours sont déjà réservés.",
            conflictingDates: conflicting,
          },
          { status: 409 }
        );
      }
    } catch (availError) {
      console.error("[Booking] Availability check failed:", availError);
      return NextResponse.json(
        { error: "Impossible de vérifier la disponibilité. Réessayez." },
        { status: 500 }
      );
    }

    // Créer un événement provisoire : utiliser les jours civils Europe/Paris (comme à l'écran) pour éviter tout décalage
    const startYmd = toDateOnlyParis(data.startDate);
    const endYmd = toDateOnlyParis(data.endDate);

    let eventId: string;
    try {
      console.log(`[Booking] Création événement pour ${data.apartmentName}, ${startYmd} → ${endYmd}, Calendar ID: ${calendarId}`);
      const startTime = Date.now();
      
      const description = [
        `Réservation provisoire pour ${data.name}`,
        `Email: ${data.email}`,
        `Téléphone: ${data.phone}`,
        `Adresse: ${data.address}`,
        `Prix total: ${typeof data.totalPrice === "number" ? data.totalPrice.toFixed(2) : data.totalPrice}€`,
        `Nombre de personnes: ${data.guests}`,
      ].join("\n");

      // Heures fixes en Europe/Paris : arrivée 15h, départ 10h (évite toute ambiguïté UTC)
      const calendarPromise = createCalendarEvent(
        {
          summary: `[PROVISOIRE] ${data.apartmentName}`,
          description,
          start: {
            dateTime: `${startYmd}T15:00:00`,
            timeZone: "Europe/Paris",
          },
          end: {
            dateTime: `${endYmd}T10:00:00`,
            timeZone: "Europe/Paris",
          },
          colorId: "9", // Gris pour provisoire
          extendedProperties: {
            private: {
              status: "pending",
              apartmentId: data.apartmentId,
            },
          },
        },
        calendarId
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: La création de l'événement a pris plus de 10 secondes")), 10000);
      });

      eventId = await Promise.race([calendarPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      console.log(`[Booking] Événement créé avec succès en ${duration}ms, Event ID: ${eventId}`);
    } catch (calendarError) {
      console.error("[Booking] Google Calendar error:", calendarError);
      return NextResponse.json(
        {
          error: "Erreur lors de la création de l'événement dans le calendrier. Vérifiez que le Calendar ID est correct et que le Service Account a les permissions.",
          details: calendarError instanceof Error ? calendarError.message : "Erreur inconnue",
        },
        { status: 500 }
      );
    }


    return NextResponse.json({
      success: true,
      message: "Demande de réservation envoyée avec succès",
      eventId: eventId,
    });
  } catch (error) {
    console.error("Booking error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue",
      },
      { status: 500 }
    );
  }
}
