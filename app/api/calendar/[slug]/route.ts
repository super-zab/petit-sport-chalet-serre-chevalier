// Disponibilités et prix d'un appartement pour le calendrier public.
// Toujours lu en direct dans la base : un changement dans /admin est visible immédiatement.

import { after, NextResponse } from "next/server";
import { isApartmentSlug } from "@/lib/apartments";
import { getPublicCalendar } from "@/lib/bookings";
import { syncStaleFeeds } from "@/lib/ical";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!isApartmentSlug(slug)) {
    return NextResponse.json({ error: "Appartement introuvable" }, { status: 404 });
  }
  try {
    const calendar = await getPublicCalendar(slug);
    // Rafraîchit Airbnb/Booking en arrière-plan si la dernière synchronisation date.
    after(() => syncStaleFeeds(30, slug).catch(() => {}));
    return NextResponse.json(calendar, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[calendar]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Calendrier momentanément indisponible" }, { status: 503 });
  }
}
