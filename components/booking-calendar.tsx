"use client";

import { useState, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import type { DayContentProps } from "react-day-picker";
import "react-day-picker/dist/style.css";
import "@/app/day-picker.css";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface BookingCalendarProps {
  onDateSelect: (startDate: Date | null, endDate: Date | null) => void;
  calendarId?: string;
  apartmentSlug?: string;
}

export function BookingCalendar({ onDateSelect, calendarId, apartmentSlug }: BookingCalendarProps) {
  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [occupiedDaysSet, setOccupiedDaysSet] = useState<Set<string>>(new Set());
  const [pricesByDay, setPricesByDay] = useState<Record<string, number>>({});
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  // Charger les dates occupées depuis l'API (liste de jours YYYY-MM-DD)
  useEffect(() => {
    if (!calendarId) return;

    setIsLoadingAvailability(true);
    fetch("/api/availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendarId,
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.occupiedDays)) {
          setOccupiedDaysSet(new Set(data.occupiedDays));
        }
      })
      .catch((error) => {
        console.error("Error fetching availability:", error);
      })
      .finally(() => {
        setIsLoadingAvailability(false);
      });
  }, [calendarId]);

  // Charger les prix par jour pour le calendrier (2 mois autour d'aujourd'hui)
  useEffect(() => {
    if (!apartmentSlug) return;
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    fetch("/api/pricing/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apartmentSlug,
        timeMin: start.toISOString().slice(0, 10),
        timeMax: end.toISOString().slice(0, 10),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.prices) setPricesByDay(data.prices);
      })
      .catch(() => {});
  }, [apartmentSlug]);

  const isDateOccupied = (date: Date): boolean => {
    return occupiedDaysSet.has(toLocalDateString(date));
  };

  // Fonction pour désactiver les dates occupées
  const isDateDisabled = (date: Date): boolean => {
    // Désactiver les dates passées
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
      return true;
    }
    // Désactiver les dates occupées
    return isDateOccupied(date);
  };

  const handleSelect = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    if (range) {
      setRange(range);
      onDateSelect(range.from || null, range.to || null);
    }
  };

  const DayWithPrice = useCallback(
    (props: DayContentProps) => {
      const dateStr = toLocalDateString(props.date);
      const price = pricesByDay[dateStr];
      return (
        <span className="flex flex-col items-center gap-0.5">
          <span>{format(props.date, "d")}</span>
          {price != null && (
            <span className="text-[10px] font-medium text-chalet-brown/80">{price}€</span>
          )}
        </span>
      );
    },
    [pricesByDay]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-chalet-brown">Sélectionnez vos dates</h3>
        {isLoadingAvailability && (
          <p className="text-sm text-chalet-brown/60 mb-2">Chargement de la disponibilité...</p>
        )}
        <div className="inline-block w-full max-w-[320px] overflow-hidden rounded-md border border-chalet-brown bg-white p-2">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            locale={fr}
            numberOfMonths={1}
            defaultMonth={new Date()}
            captionLayout="buttons"
            className="booking-calendar-single"
            disabled={isDateDisabled}
            modifiers={{
              occupied: (date) => isDateOccupied(date),
            }}
            modifiersClassNames={{
              occupied: "bg-chalet-greige/50 text-chalet-brown/50 cursor-not-allowed",
            }}
            components={{
              DayContent: DayWithPrice,
            }}
          />
        </div>
      </div>
      {range.from && (
        <div className="text-sm text-chalet-brown/80">
          <p>
            Du {format(range.from, "PPP", { locale: fr })}
            {range.to && ` au ${format(range.to, "PPP", { locale: fr })}`}
          </p>
        </div>
      )}
    </div>
  );
}
