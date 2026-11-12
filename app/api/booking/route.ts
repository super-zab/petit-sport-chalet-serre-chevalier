// Réception d'une demande de réservation envoyée depuis le site public.
// Rien de ce qu'envoie le navigateur n'est cru sur parole : le prix et la disponibilité
// sont recalculés ici à partir de la base.

import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError, createBookingRequest } from "@/lib/bookings";
import { sendAdminNewRequest, sendClientRequestReceived } from "@/lib/email";
import { syncStaleFeeds } from "@/lib/ical";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bookingSchema = z.object({
  apartmentSlug: z.string().min(1).max(20),
  checkIn: day,
  checkOut: day,
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200).pipe(z.email()),
  phone: z.string().trim().regex(/^[+0-9 ().-]{6,25}$/),
  address: z.string().trim().min(5).max(300),
  guests: z.coerce.number().int().min(1).max(30),
  // Champ piège invisible pour les humains : s'il est rempli, c'est un robot.
  website: z.string().max(200).optional(),
});

function json(body: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: Request) {
  // Refuse les envois déclenchés depuis un autre site.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !URL.canParse(origin)) return json({ error: "Requête refusée." }, 403);
  if (origin && host && new URL(origin).host !== host) {
    return json({ error: "Requête refusée." }, 403);
  }

  try {
    const ip = await clientIp();
    const limit = await rateLimit(`booking:${ip}`, 5, 600);
    if (!limit.ok) {
      return json(
        { error: "Trop de demandes envoyées. Réessayez dans quelques minutes ou contactez-nous par téléphone." },
        429,
        { "Retry-After": String(limit.retryAfter) }
      );
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Demande trop volumineuse." }, 413);
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: "Demande illisible." }, 400);
    }
    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) {
      return json({ error: "Certains champs sont invalides. Vérifiez votre saisie." }, 400);
    }
    const data = parsed.data;
    if (data.website) return json({ success: true }, 200);

    // Vérifie Airbnb/Booking juste avant d'accepter la demande (6 s maximum).
    await Promise.race([
      syncStaleFeeds(10, data.apartmentSlug).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);

    const { reservation, isNew } = await createBookingRequest(data);
    if (isNew) {
      await Promise.allSettled([sendAdminNewRequest(reservation), sendClientRequestReceived(reservation)]);
    }
    return json({ success: true }, 200);
  } catch (error) {
    if (error instanceof BookingError) {
      return json({ error: error.message, code: error.code }, error.code === "unavailable" ? 409 : 400);
    }
    console.error("[booking]", error instanceof Error ? error.message : error);
    return json({ error: "Une erreur est survenue. Réessayez ou contactez-nous par téléphone." }, 500);
  }
}
