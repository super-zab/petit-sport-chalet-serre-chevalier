"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  diffDays,
  eachDay,
  formatDay,
  formatMonth,
  monthGrid,
  monthStart,
  type Day,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

export interface CalendarData {
  today: Day;
  until: Day;
  defaultPriceCents: number;
  prices: Record<Day, number>;
  busy: Array<[Day, Day]>;
}

export interface StaySelection {
  checkIn: Day | null;
  checkOut: Day | null;
}

interface BookingCalendarProps {
  data: CalendarData;
  maxNights: number;
  selection: StaySelection;
  onChange: (selection: StaySelection) => void;
}

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** Nuits occupées : chaque jour d'une période [début, fin exclue]. */
export function busyNights(busy: Array<[Day, Day]>): Set<Day> {
  const nights = new Set<Day>();
  for (const [start, end] of busy) for (const day of eachDay(start, end)) nights.add(day);
  return nights;
}

/**
 * Dernier jour de départ possible pour une arrivée donnée : le premier jour occupé
 * qui suit (on peut partir le matin où d'autres arrivent), borné par la durée maximale.
 */
export function lastCheckOut(checkIn: Day, nights: Set<Day>, until: Day, maxNights: number): Day {
  let day = addDays(checkIn, 1);
  const limit = addDays(checkIn, maxNights);
  while (day < until && day < limit && !nights.has(day)) day = addDays(day, 1);
  return day;
}

export function BookingCalendar({ data, maxNights, selection, onChange }: BookingCalendarProps) {
  const firstMonth = monthStart(data.today);
  const lastMonth = monthStart(data.until);
  const [month, setMonth] = useState<Day>(selection.checkIn ? monthStart(selection.checkIn) : firstMonth);
  const nights = useMemo(() => busyNights(data.busy), [data.busy]);
  const days = useMemo(() => monthGrid(month), [month]);

  const { checkIn, checkOut } = selection;
  const choosingCheckOut = checkIn !== null && checkOut === null;
  const maxCheckOut = checkIn ? lastCheckOut(checkIn, nights, data.until, maxNights) : null;

  const canArrive = (day: Day) => day >= data.today && day < data.until && !nights.has(day);
  const canLeave = (day: Day) => choosingCheckOut && maxCheckOut !== null && day > checkIn! && day <= maxCheckOut;

  function handleClick(day: Day) {
    if (choosingCheckOut) {
      if (day === checkIn) return onChange({ checkIn: null, checkOut: null });
      if (canLeave(day)) return onChange({ checkIn, checkOut: day });
    }
    if (canArrive(day)) onChange({ checkIn: day, checkOut: null });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          disabled={month <= firstMonth}
          aria-label="Mois précédent"
          className="rounded-sm border border-chalet-brown/40 p-2 text-chalet-brown transition-colors hover:bg-chalet-cream-light disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold capitalize text-chalet-brown" aria-live="polite">
          {formatMonth(month)}
        </p>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          disabled={month >= lastMonth}
          aria-label="Mois suivant"
          className="rounded-sm border border-chalet-brown/40 p-2 text-chalet-brown transition-colors hover:bg-chalet-cream-light disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="pb-1 text-[11px] font-medium uppercase text-chalet-muted">
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          if (day.slice(0, 7) !== month.slice(0, 7)) return <div key={day} aria-hidden="true" />;

          const occupied = nights.has(day);
          const arrivable = canArrive(day);
          const leavable = canLeave(day);
          const clickable = arrivable || leavable || day === checkIn;
          const isStart = day === checkIn;
          const isEnd = day === checkOut;
          const inRange = checkIn !== null && checkOut !== null && day > checkIn && day < checkOut;
          const price = data.prices[day] ?? data.defaultPriceCents;
          const showPrice = !occupied && day >= data.today && day < data.until && !isEnd;

          const state = isStart
            ? "arrivée sélectionnée"
            : isEnd
              ? "départ sélectionné"
              : leavable && occupied
                ? "départ possible"
                : occupied
                  ? "indisponible"
                  : arrivable
                    ? `${Math.round(price / 100)} euros la nuit`
                    : "indisponible";

          return (
            <button
              key={day}
              type="button"
              disabled={!clickable}
              onClick={() => handleClick(day)}
              aria-label={`${formatDay(day, { weekday: "long", day: "numeric", month: "long" })}, ${state}`}
              aria-pressed={isStart || isEnd}
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-sm border text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalet-brown focus-visible:ring-offset-1",
                isStart || isEnd
                  ? "border-chalet-brown bg-chalet-brown font-semibold text-chalet-cream"
                  : inRange
                    ? "border-chalet-brown/20 bg-chalet-brown/15 text-chalet-brown"
                    : clickable
                      ? "border-chalet-brown/20 bg-white text-chalet-brown hover:border-chalet-brown hover:bg-chalet-cream-light"
                      : occupied && day >= data.today
                        ? "border-transparent bg-chalet-muted/15 text-chalet-muted line-through"
                        : "border-transparent text-chalet-muted/50",
                choosingCheckOut && leavable && !isEnd && "border-chalet-brown/60"
              )}
            >
              <span>{Number(day.slice(8))}</span>
              {showPrice && (
                <span className={cn("text-[10px] leading-none", isStart ? "text-chalet-cream/80" : "text-chalet-muted")}>
                  {Math.round(price / 100)}€
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-chalet-brown/80" aria-live="polite">
        {checkIn === null && "Choisissez votre date d'arrivée."}
        {choosingCheckOut && "Choisissez maintenant votre date de départ."}
        {checkIn && checkOut && (
          <>
            Du {formatDay(checkIn)} au {formatDay(checkOut)} · {diffDays(checkIn, checkOut)} nuit
            {diffDays(checkIn, checkOut) > 1 ? "s" : ""}
          </>
        )}
      </p>
      <p className="mt-1 flex items-center gap-2 text-xs text-chalet-muted">
        <span className="inline-block h-3 w-3 rounded-sm bg-chalet-muted/25" aria-hidden="true" />
        Dates barrées : déjà réservées
      </p>
    </div>
  );
}
