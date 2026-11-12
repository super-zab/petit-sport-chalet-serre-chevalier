"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Mail, Phone } from "lucide-react";
import type { ActionResult } from "@/app/admin/actions";
import {
  acceptRequestAction,
  blockRangeAction,
  refuseRequestAction,
  setPricesAction,
  unblockRangeAction,
} from "@/app/admin/actions";
import { ReservationDialog, type DialogState } from "@/components/admin/reservation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminMonth, ExternalEvent, PendingRequest, Reservation } from "@/lib/bookings";
import {
  addDays,
  addMonths,
  diffDays,
  formatDay,
  formatDayShort,
  formatEuros,
  formatMonth,
  weekdayMondayFirst,
  type Day,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

interface ApartmentTab {
  slug: string;
  shortName: string;
  name: string;
}

interface DashboardProps {
  apartments: ApartmentTab[];
  slug: string;
  month: Day;
  today: Day;
  days: Day[];
  data: AdminMonth;
  pending: PendingRequest[];
  upcoming: Reservation[];
}

interface Selection {
  anchor: Day;
  from: Day;
  to: Day;
  /** Vrai tant qu'un second clic peut étendre la sélection. */
  extending: boolean;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const REFRESH_MS = 20_000;

const covers = (start: Day, endExclusive: Day, day: Day) => start <= day && day < endExclusive;
const href = (slug: string, month: Day) => `/admin?apt=${slug}&m=${month.slice(0, 7)}`;
const nightsLabel = (count: number) => `${count} nuit${count > 1 ? "s" : ""}`;

function formatReceived(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function Dashboard({ apartments, slug, month, today, days, data, pending, upcoming }: DashboardProps) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [blockNote, setBlockNote] = useState("");
  const [refusingId, setRefusingId] = useState<string | null>(null);

  const apartment = apartments.find((item) => item.slug === slug)!;
  const shortName = (apartmentSlug: string) =>
    apartments.find((item) => item.slug === apartmentSlug)?.shortName ?? apartmentSlug;

  // Données en direct : la page se rafraîchit seule quand elle est visible et qu'aucune fenêtre n'est ouverte.
  useEffect(() => {
    if (dialog) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [dialog, router]);

  useEffect(() => {
    if (!toast?.ok) return;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  function perform(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          setToast({ ok: true, text: result.message });
          onSuccess?.();
        } else {
          setToast({ ok: false, text: result.error });
        }
      } catch {
        setToast({ ok: false, text: "Connexion perdue. Rechargez la page et réessayez." });
      }
    });
  }

  const cells = useMemo(
    () =>
      days.map((day) => {
        const confirmed = data.reservations.filter(
          (item) => item.status === "confirmed" && covers(item.checkIn, item.checkOut, day)
        );
        return {
          day,
          stay: confirmed.find((item) => item.kind === "guest") ?? null,
          block: confirmed.find((item) => item.kind === "block") ?? null,
          external: data.external.find((item) => covers(item.startDay, item.endDay, day)) ?? null,
          requests: data.reservations.filter(
            (item) => item.status === "pending" && covers(item.checkIn, item.checkOut, day)
          ),
          priceCents: data.prices[day] ?? data.defaultPriceCents,
          customPrice: day in data.prices,
        };
      }),
    [days, data]
  );

  function selectDay(day: Day) {
    setSelection((current) => {
      if (current?.extending && day !== current.anchor) {
        const [from, to] = day < current.anchor ? [day, current.anchor] : [current.anchor, day];
        return { anchor: current.anchor, from, to, extending: false };
      }
      return { anchor: day, from: day, to: day, extending: true };
    });
    setPriceInput("");
  }

  const selected = selection ? cells.filter((cell) => cell.day >= selection.from && cell.day <= selection.to) : [];
  const selectionNights = selection ? diffDays(selection.from, selection.to) + 1 : 0;
  const selectionHasStay = selected.some((cell) => cell.stay);
  const selectionHasBlock = selected.some((cell) => cell.block);
  const selectionHasExternal = selected.some((cell) => cell.external);
  const range = selection ? { slug, from: selection.from, toExclusive: addDays(selection.to, 1) } : null;

  function applyPrice() {
    const value = Number(priceInput.trim().replace(",", "."));
    if (!range || priceInput.trim() === "" || !Number.isFinite(value) || value < 0) {
      return setToast({ ok: false, text: "Saisissez un prix valide, par exemple 180." });
    }
    perform(() => setPricesAction({ ...range, priceEuros: value }), () => setPriceInput(""));
  }

  const pendingByApartment = (apartmentSlug: string) =>
    pending.filter((item) => item.apartmentSlug === apartmentSlug).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Calendrier" className="min-w-0">
        {/* Choix de l'appartement */}
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Appartement">
          {apartments.map((item) => {
            const count = pendingByApartment(item.slug);
            const active = item.slug === slug;
            return (
              <Link
                key={item.slug}
                href={href(item.slug, month)}
                role="tab"
                aria-selected={active}
                scroll={false}
                className={cn(
                  "flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-chalet-brown bg-chalet-brown text-chalet-cream"
                    : "border-chalet-brown/40 bg-white hover:border-chalet-brown"
                )}
              >
                {item.shortName}
                {count > 0 && (
                  <span
                    className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-chalet-brown-dark"
                    title={`${count} demande${count > 1 ? "s" : ""} en attente`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {toast && (
          <div
            role={toast.ok ? "status" : "alert"}
            className={cn(
              "mb-4 flex items-start justify-between gap-3 rounded-sm border px-4 py-3 text-sm",
              toast.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-800"
            )}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="shrink-0 underline">
              Fermer
            </button>
          </div>
        )}

        <div className="rounded-sm border border-chalet-brown bg-white">
          {/* Navigation dans les mois */}
          <div className="flex items-center justify-between gap-2 border-b border-chalet-brown/20 px-3 py-3">
            <div className="flex items-center gap-1">
              <Link
                href={href(slug, addMonths(month, -1))}
                scroll={false}
                aria-label="Mois précédent"
                className="rounded-sm border border-chalet-brown/40 p-2 hover:bg-chalet-cream-light"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={href(slug, addMonths(month, 1))}
                scroll={false}
                aria-label="Mois suivant"
                className="rounded-sm border border-chalet-brown/40 p-2 hover:bg-chalet-cream-light"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
              <h1 className="ml-2 text-base font-semibold capitalize sm:text-lg">{formatMonth(month)}</h1>
              {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin text-chalet-muted" aria-label="Enregistrement" />}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-chalet-muted sm:inline">
                Prix par défaut : {formatEuros(data.defaultPriceCents)}
              </span>
              <Link href={href(slug, today)} scroll={false} className="rounded-sm border border-chalet-brown/40 px-3 py-1.5 hover:bg-chalet-cream-light">
                Aujourd&apos;hui
              </Link>
            </div>
          </div>

          {/* Grille du mois */}
          <div className="grid grid-cols-7 border-b border-chalet-brown/20 text-center text-xs font-medium uppercase text-chalet-muted">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-2">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, index) => {
              const { day, stay, block, external } = cell;
              const inMonth = day.slice(0, 7) === month.slice(0, 7);
              const isSelected = selection !== null && day >= selection.from && day <= selection.to;
              const startsRow = weekdayMondayFirst(day) === 0 || index === 0;
              const occupant = stay ?? block;
              const showOccupant = occupant !== null && (occupant.checkIn === day || startsRow);
              const showExternal = external !== null && (external.startDay === day || startsRow);
              const status = stay
                ? `réservé par ${stay.guestName ?? "un client"}`
                : block
                  ? "bloqué"
                  : external
                    ? `réservé sur ${external.feedName}`
                    : "libre";

              return (
                <div
                  key={day}
                  className={cn(
                    "relative border-b border-r border-chalet-brown/15",
                    index % 7 === 6 && "border-r-0",
                    stay ? "bg-emerald-50" : block ? "admin-hatch" : external ? "bg-sky-50" : "bg-white",
                    !inMonth && "opacity-50",
                    day < today && "text-chalet-muted"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    aria-pressed={isSelected}
                    aria-label={`${formatDay(day, { weekday: "long", day: "numeric", month: "long" })}, ${status}, ${formatEuros(cell.priceCents)} la nuit`}
                    className={cn(
                      "absolute inset-0 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-chalet-brown",
                      isSelected ? "bg-chalet-brown/10 ring-2 ring-inset ring-chalet-brown" : "hover:bg-chalet-brown/5"
                    )}
                  />
                  <div className="pointer-events-none relative flex min-h-[4.75rem] flex-col gap-0.5 p-1 sm:min-h-[5.5rem] sm:p-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm",
                          day === today && "bg-chalet-brown font-semibold text-chalet-cream"
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                      {cell.requests.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDialog({ mode: "edit", reservation: cell.requests[0] })}
                          title={`${cell.requests.length} demande${cell.requests.length > 1 ? "s" : ""} en attente`}
                          aria-label={`${cell.requests.length} demande en attente, ouvrir`}
                          className="pointer-events-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-semibold text-chalet-brown-dark hover:bg-amber-500"
                        >
                          {cell.requests.length}
                        </button>
                      )}
                    </div>

                    {showOccupant && occupant && (
                      <button
                        type="button"
                        onClick={() => setDialog({ mode: "edit", reservation: occupant })}
                        className={cn(
                          "pointer-events-auto truncate rounded-sm px-1 py-0.5 text-left text-[11px] font-medium leading-tight text-white",
                          occupant.kind === "guest" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-chalet-muted hover:bg-chalet-brown"
                        )}
                      >
                        {occupant.kind === "guest" ? (occupant.guestName ?? "Réservé") : "Bloqué"}
                      </button>
                    )}
                    {showExternal && external && (
                      <button
                        type="button"
                        onClick={() => setDialog({ mode: "external", event: external })}
                        className="pointer-events-auto truncate rounded-sm bg-sky-700 px-1 py-0.5 text-left text-[11px] font-medium leading-tight text-white hover:bg-sky-800"
                      >
                        {external.feedName}
                      </button>
                    )}
                    {stay && external && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-700" title="Chevauchement à vérifier">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        <span className="hidden sm:inline">Doublon ?</span>
                      </span>
                    )}

                    <span
                      className={cn(
                        "mt-auto text-right text-[11px] leading-none sm:text-xs",
                        cell.customPrice ? "font-semibold text-chalet-brown" : "text-chalet-muted"
                      )}
                    >
                      {formatEuros(cell.priceCents)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-chalet-brown/20 px-3 py-2 text-xs text-chalet-muted">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-700" />Réservé</span>
            <span className="flex items-center gap-1.5"><span className="admin-hatch h-3 w-3 rounded-sm border border-chalet-muted" />Bloqué</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-sky-700" />Airbnb / Booking</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400" />Demande en attente</span>
            <span><strong className="text-chalet-brown">Prix en gras</strong> : modifié pour ce jour</span>
          </div>
        </div>

        {/* Actions sur les dates sélectionnées */}
        <div className="mt-4 rounded-sm border border-chalet-brown bg-white p-4" aria-live="polite">
          {!selection || !range ? (
            <p className="text-sm text-chalet-brown/80">
              Cliquez sur un jour pour modifier son prix, le bloquer ou créer une réservation. Cliquez ensuite sur un
              second jour pour sélectionner toute la période.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">
                  {selectionNights === 1
                    ? `Nuit du ${formatDayShort(selection.from)}`
                    : `${nightsLabel(selectionNights)} · du ${formatDayShort(selection.from)} au ${formatDayShort(selection.to)} inclus`}
                </h2>
                <button type="button" onClick={() => setSelection(null)} className="text-sm underline">
                  Effacer la sélection
                </button>
              </div>
              {selection.extending && (
                <p className="text-sm text-chalet-muted">Cliquez sur un autre jour pour étendre la sélection.</p>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="price-input" className="text-sm font-medium">
                    Prix par nuit (€)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="price-input"
                      inputMode="decimal"
                      placeholder={String(data.defaultPriceCents / 100)}
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyPrice();
                      }}
                    />
                    <Button type="button" disabled={busy} onClick={applyPrice}>
                      Appliquer
                    </Button>
                  </div>
                  {selected.some((cell) => cell.customPrice) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => perform(() => setPricesAction({ ...range, priceEuros: null }))}
                      className="text-left text-sm underline disabled:opacity-50"
                    >
                      Revenir au prix par défaut ({formatEuros(data.defaultPriceCents)})
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="block-note" className="text-sm font-medium">
                    Disponibilité
                  </label>
                  {selectionHasStay ? (
                    <p className="text-sm text-chalet-muted">
                      La période contient une réservation : ouvrez-la depuis le calendrier pour la modifier.
                    </p>
                  ) : (
                    <>
                      <Input
                        id="block-note"
                        placeholder="Motif du blocage (facultatif)"
                        maxLength={200}
                        value={blockNote}
                        onChange={(event) => setBlockNote(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy || selectionHasExternal}
                          onClick={() => perform(() => blockRangeAction({ ...range, note: blockNote }), () => setBlockNote(""))}
                        >
                          Bloquer
                        </Button>
                        {selectionHasBlock && (
                          <Button type="button" variant="outline" disabled={busy} onClick={() => perform(() => unblockRangeAction(range))}>
                            Débloquer
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Réservation</p>
                  <Button
                    type="button"
                    disabled={busy || selectionHasStay || selectionHasBlock || selectionHasExternal}
                    onClick={() => setDialog({ mode: "create", slug, checkIn: range.from, checkOut: range.toExclusive })}
                  >
                    Créer une réservation
                  </Button>
                  <p className="text-xs text-chalet-muted">
                    Arrivée le {formatDayShort(range.from)} · départ le {formatDayShort(range.toExclusive)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        {/* Demandes en attente */}
        <section className="rounded-sm border border-chalet-brown bg-white" aria-labelledby="pending-title">
          <h2 id="pending-title" className="border-b border-chalet-brown/20 px-4 py-3 text-base font-semibold">
            Demandes en attente{pending.length > 0 && ` (${pending.length})`}
          </h2>
          {pending.length === 0 ? (
            <p className="px-4 py-4 text-sm text-chalet-muted">Aucune demande à traiter.</p>
          ) : (
            <ul className="divide-y divide-chalet-brown/15">
              {pending.map((request) => (
                <li key={request.id} className="space-y-2 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={href(request.apartmentSlug, request.checkIn)}
                      scroll={false}
                      className="rounded-sm bg-chalet-cream-light px-2 py-0.5 text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      {shortName(request.apartmentSlug)}
                    </Link>
                    <span className="text-xs text-chalet-muted">reçue le {formatReceived(request.createdAt)}</span>
                  </div>
                  <p className="font-semibold">
                    {request.guestName}
                    {request.guests ? ` · ${request.guests} pers.` : ""}
                  </p>
                  <p>
                    {formatDayShort(request.checkIn)} → {formatDayShort(request.checkOut)} ·{" "}
                    {nightsLabel(diffDays(request.checkIn, request.checkOut))}
                    {request.totalPriceCents !== null && ` · ${formatEuros(request.totalPriceCents)}`}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-chalet-brown/80">
                    {request.guestPhone && (
                      <a href={`tel:${request.guestPhone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-1 hover:underline">
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                        {request.guestPhone}
                      </a>
                    )}
                    {request.guestEmail && (
                      <a href={`mailto:${request.guestEmail}`} className="flex min-w-0 items-center gap-1 hover:underline">
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{request.guestEmail}</span>
                      </a>
                    )}
                  </div>
                  {request.conflict && (
                    <p className="flex items-start gap-1.5 rounded-sm bg-red-50 px-2 py-1.5 text-red-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {request.conflict}
                    </p>
                  )}
                  {refusingId === request.id ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => perform(() => refuseRequestAction(request.id, true), () => setRefusingId(null))}
                      >
                        Refuser et prévenir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => perform(() => refuseRequestAction(request.id, false), () => setRefusingId(null))}
                      >
                        Sans email
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRefusingId(null)}>
                        Retour
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={busy || request.conflict !== null}
                        onClick={() => perform(() => acceptRequestAction(request.id))}
                      >
                        Accepter
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setRefusingId(request.id)}>
                        Refuser
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ mode: "edit", reservation: request })}>
                        Détails
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Prochains séjours */}
        <section className="rounded-sm border border-chalet-brown bg-white" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="border-b border-chalet-brown/20 px-4 py-3 text-base font-semibold">
            Prochains séjours
          </h2>
          {upcoming.length === 0 ? (
            <p className="px-4 py-4 text-sm text-chalet-muted">Aucun séjour confirmé à venir.</p>
          ) : (
            <ul className="divide-y divide-chalet-brown/15">
              {upcoming.map((stay) => (
                <li key={stay.id}>
                  <Link
                    href={href(stay.apartmentSlug, stay.checkIn)}
                    scroll={false}
                    className="block px-4 py-3 text-sm hover:bg-chalet-cream-light"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{stay.guestName ?? "Réservation"}</span>
                      <span className="shrink-0 text-xs text-chalet-muted">{shortName(stay.apartmentSlug)}</span>
                    </span>
                    <span className="text-chalet-brown/80">
                      {formatDayShort(stay.checkIn)} → {formatDayShort(stay.checkOut)}
                      {stay.checkIn <= today && " · en cours"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      {dialog && (
        <ReservationDialog
          key={dialog.mode === "edit" ? dialog.reservation.id : dialog.mode === "external" ? dialog.event.id : "create"}
          state={dialog}
          apartmentName={
            dialog.mode === "edit"
              ? (apartments.find((item) => item.slug === dialog.reservation.apartmentSlug)?.name ?? apartment.name)
              : apartment.name
          }
          busy={busy}
          error={toast && !toast.ok ? toast.text : null}
          perform={(action, closeOnSuccess) =>
            perform(action, () => {
              if (closeOnSuccess) setDialog(null);
              setSelection(null);
            })
          }
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
