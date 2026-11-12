// Calendrier .ics d'un appartement, à importer dans Airbnb, Booking.com, etc.
// L'adresse contient un jeton secret propre à chaque appartement.

import { exportCalendar } from "@/lib/ical";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const body = await exportCalendar(file.replace(/\.ics$/i, "")).catch((error) => {
    console.error("[ical export]", error instanceof Error ? error.message : error);
    return null;
  });
  if (body === null) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
