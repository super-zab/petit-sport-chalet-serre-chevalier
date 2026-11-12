"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { BookingCalendar, busyNights, type CalendarData, type StaySelection } from "@/components/booking-calendar";
import { BookingForm } from "@/components/booking-form";
import { site } from "@/config/site";
import { diffDays, eachDay, formatEuros } from "@/lib/dates";

const MAX_NIGHTS = 60;
const REFRESH_MS = 60_000;

interface ApartmentBookingProps {
  slug: string;
  maxGuests: number;
}

export function ApartmentBooking({ slug, maxGuests }: ApartmentBookingProps) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selection, setSelection] = useState<StaySelection>({ checkIn: null, checkOut: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/calendar/${slug}`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setData(await response.json());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [slug]);

  // Disponibilités et prix en direct : rechargés régulièrement et au retour sur l'onglet.
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Si les dates choisies viennent d'être prises par quelqu'un d'autre, on le dit tout de suite.
  useEffect(() => {
    if (!data || !selection.checkIn) return;
    const nights = busyNights(data.busy);
    const end = selection.checkOut ?? selection.checkIn;
    const taken =
      nights.has(selection.checkIn) || eachDay(selection.checkIn, end).some((day) => nights.has(day));
    if (taken) {
      setSelection({ checkIn: null, checkOut: null });
      setNotice("Les dates que vous aviez choisies viennent d'être réservées. Merci d'en sélectionner d'autres.");
    }
  }, [data, selection]);

  const quote = useMemo(() => {
    if (!data || !selection.checkIn || !selection.checkOut) return null;
    const nights = diffDays(selection.checkIn, selection.checkOut);
    const totalCents = eachDay(selection.checkIn, selection.checkOut).reduce(
      (sum, day) => sum + (data.prices[day] ?? data.defaultPriceCents),
      0
    );
    return { nights, totalCents };
  }, [data, selection]);

  if (isSuccess) {
    return (
      <div className="py-8 text-center" role="status">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-chalet-brown" />
        <h3 className="mb-2 text-xl font-semibold text-chalet-brown">Demande envoyée !</h3>
        <p className="text-chalet-brown/80">
          Nous vérifions la disponibilité et vous confirmons votre séjour par email très rapidement.
        </p>
      </div>
    );
  }

  if (!data) {
    return loadFailed ? (
      <p className="text-sm text-chalet-brown/80">
        Le calendrier est momentanément indisponible. Contactez-nous au{" "}
        <a className="underline" href={site.phones[0].href}>
          {site.phones[0].label}
        </a>
        .
      </p>
    ) : (
      <div className="flex items-center justify-center py-12 text-chalet-brown/60" role="status">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">Chargement des disponibilités…</span>
      </div>
    );
  }

  return (
    <div>
      <BookingCalendar
        data={data}
        maxNights={MAX_NIGHTS}
        selection={selection}
        onChange={(next) => {
          setNotice(null);
          setSelection(next);
        }}
      />

      {notice && (
        <p role="alert" className="mt-4 rounded-sm border border-chalet-brown/30 bg-chalet-cream-light px-3 py-2 text-sm font-medium text-chalet-brown">
          {notice}
        </p>
      )}

      {quote && selection.checkIn && selection.checkOut && (
        <>
          <div className="mt-6 rounded-sm border border-chalet-brown bg-chalet-cream-light p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-chalet-brown">Prix total</span>
              <span className="text-2xl font-semibold text-chalet-brown">{formatEuros(quote.totalCents)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-chalet-brown/20 pt-2 text-sm text-chalet-brown/80">
              <span>
                {quote.nights} nuit{quote.nights > 1 ? "s" : ""}
              </span>
              <span>{formatEuros(Math.round(quote.totalCents / quote.nights))} / nuit en moyenne</span>
            </div>
          </div>
          <div className="mt-6 border-t border-chalet-brown/20 pt-6">
            <BookingForm
              apartmentSlug={slug}
              maxGuests={maxGuests}
              checkIn={selection.checkIn}
              checkOut={selection.checkOut}
              onSuccess={() => setIsSuccess(true)}
              onUnavailable={(message) => {
                setSelection({ checkIn: null, checkOut: null });
                setNotice(message);
                load();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
