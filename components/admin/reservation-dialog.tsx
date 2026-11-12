"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ActionResult } from "@/app/admin/actions";
import {
  acceptRequestAction,
  cancelReservationAction,
  createReservationAction,
  refuseRequestAction,
  updateReservationAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExternalEvent, Reservation } from "@/lib/bookings";
import { addDays, diffDays, formatDay, isDay, type Day } from "@/lib/dates";

export type DialogState =
  | { mode: "create"; slug: string; checkIn: Day; checkOut: Day }
  | { mode: "edit"; reservation: Reservation }
  | { mode: "external"; event: ExternalEvent };

interface ReservationDialogProps {
  state: DialogState;
  apartmentName: string;
  busy: boolean;
  /** Erreur renvoyée par la dernière action, affichée dans la fenêtre. */
  error: string | null;
  /** Lance une action serveur ; ferme la fenêtre si elle réussit. */
  perform: (action: () => Promise<ActionResult>, closeOnSuccess?: boolean) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Demande en attente",
  confirmed: "Réservation confirmée",
};

export function ReservationDialog({ state, apartmentName, busy, error, perform, onClose }: ReservationDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const reservation = state.mode === "edit" ? state.reservation : null;
  const isBlock = reservation?.kind === "block";

  const [form, setForm] = useState(() => ({
    checkIn: reservation?.checkIn ?? (state.mode === "create" ? state.checkIn : ""),
    checkOut: reservation?.checkOut ?? (state.mode === "create" ? state.checkOut : ""),
    guestName: reservation?.guestName ?? "",
    guestEmail: reservation?.guestEmail ?? "",
    guestPhone: reservation?.guestPhone ?? "",
    guestAddress: reservation?.guestAddress ?? "",
    guests: reservation?.guests?.toString() ?? "",
    totalPriceEuros:
      reservation?.totalPriceCents != null ? String(reservation.totalPriceCents / 100).replace(".", ",") : "",
    notes: reservation?.notes ?? "",
  }));
  const [confirming, setConfirming] = useState<"cancel" | "refuse" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const update =
    (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  function payload() {
    const price = form.totalPriceEuros.trim().replace(",", ".");
    return {
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      guestName: form.guestName,
      guestEmail: form.guestEmail,
      guestPhone: form.guestPhone,
      guestAddress: form.guestAddress,
      guests: form.guests.trim() === "" ? null : Number(form.guests),
      totalPriceEuros: price === "" ? null : Number(price),
      notes: form.notes,
    };
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const data = payload();
    if (!isDay(data.checkIn) || !isDay(data.checkOut) || data.checkOut <= data.checkIn) {
      return setLocalError("La date de départ doit être après la date d'arrivée.");
    }
    if (data.totalPriceEuros !== null && !Number.isFinite(data.totalPriceEuros)) {
      return setLocalError("Le prix total n'est pas un nombre valide.");
    }
    setLocalError(null);
    if (state.mode === "create") {
      perform(() => createReservationAction({ slug: state.slug, ...data }), true);
    } else if (reservation) {
      perform(() => updateReservationAction(reservation.id, data), true);
    }
  }

  const nights =
    isDay(form.checkIn) && isDay(form.checkOut) && form.checkOut > form.checkIn
      ? diffDays(form.checkIn, form.checkOut)
      : null;

  const title =
    state.mode === "create"
      ? "Nouvelle réservation"
      : state.mode === "external"
        ? `Réservation ${state.event.feedName}`
        : isBlock
          ? "Dates bloquées"
          : STATUS_LABEL[reservation!.status];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="reservation-dialog-title"
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-sm border border-chalet-brown bg-white p-0 text-chalet-brown backdrop:bg-chalet-brown/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-chalet-brown/20 px-5 py-4">
        <div>
          <h2 id="reservation-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-chalet-muted">{apartmentName}</p>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Fermer"
          className="rounded-sm p-1 hover:bg-chalet-cream-light"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <p role="alert" className="mx-5 mt-4 rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {state.mode === "external" && (
        <div className="space-y-3 px-5 py-5 text-sm leading-relaxed">
          <p>
            Du <strong>{formatDay(state.event.startDay)}</strong> au <strong>{formatDay(state.event.endDay)}</strong>{" "}
            (départ).
          </p>
          <p className="text-chalet-brown/80">
            Cette période vient du calendrier {state.event.feedName}. Elle se modifie ou s&apos;annule directement sur{" "}
            {state.event.feedName} ; le changement apparaîtra ici à la prochaine synchronisation.
          </p>
        </div>
      )}

      {isBlock && reservation && (
        <div className="space-y-4 px-5 py-5 text-sm leading-relaxed">
          <p>
            Du <strong>{formatDay(reservation.checkIn)}</strong> au{" "}
            <strong>{formatDay(addDays(reservation.checkOut, -1))}</strong> inclus. Ces nuits ne sont pas réservables
            sur le site.
          </p>
          {reservation.notes && <p className="text-chalet-brown/80">Note : {reservation.notes}</p>}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => perform(() => cancelReservationAction(reservation.id), true)}
          >
            Supprimer ce blocage
          </Button>
        </div>
      )}

      {state.mode !== "external" && !isBlock && (
        <form onSubmit={handleSave} className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dlg-in">Arrivée</Label>
              <Input id="dlg-in" type="date" required value={form.checkIn} onChange={update("checkIn")} />
            </div>
            <div>
              <Label htmlFor="dlg-out">Départ</Label>
              <Input id="dlg-out" type="date" required min={form.checkIn || undefined} value={form.checkOut} onChange={update("checkOut")} />
            </div>
          </div>
          {nights !== null && (
            <p className="-mt-2 text-xs text-chalet-muted">
              {nights} nuit{nights > 1 ? "s" : ""}
            </p>
          )}
          <div>
            <Label htmlFor="dlg-name">Nom du client</Label>
            <Input id="dlg-name" required maxLength={120} value={form.guestName} onChange={update("guestName")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dlg-email">Email</Label>
              <Input id="dlg-email" type="email" maxLength={200} value={form.guestEmail} onChange={update("guestEmail")} />
            </div>
            <div>
              <Label htmlFor="dlg-phone">Téléphone</Label>
              <Input id="dlg-phone" type="tel" maxLength={40} value={form.guestPhone} onChange={update("guestPhone")} />
            </div>
          </div>
          <div>
            <Label htmlFor="dlg-address">Adresse</Label>
            <Input id="dlg-address" maxLength={300} value={form.guestAddress} onChange={update("guestAddress")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dlg-guests">Personnes</Label>
              <Input id="dlg-guests" type="number" inputMode="numeric" min={1} max={50} value={form.guests} onChange={update("guests")} />
            </div>
            <div>
              <Label htmlFor="dlg-price">Prix total (€)</Label>
              <Input
                id="dlg-price"
                inputMode="decimal"
                placeholder={state.mode === "create" ? "Calculé automatiquement" : ""}
                value={form.totalPriceEuros}
                onChange={update("totalPriceEuros")}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="dlg-notes">Notes internes</Label>
            <textarea
              id="dlg-notes"
              rows={2}
              maxLength={2000}
              value={form.notes}
              onChange={update("notes")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {localError && (
            <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {localError}
            </p>
          )}

          {confirming === null && (
            <div className="flex flex-wrap gap-2 border-t border-chalet-brown/20 pt-4">
              <Button type="submit" disabled={busy}>
                {state.mode === "create" ? "Enregistrer la réservation" : "Enregistrer"}
              </Button>
              {reservation?.status === "pending" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => perform(() => acceptRequestAction(reservation.id), true)}
                  >
                    Accepter
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming("refuse")}>
                    Refuser
                  </Button>
                </>
              )}
              {reservation?.status === "confirmed" && (
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming("cancel")}>
                  Annuler la réservation
                </Button>
              )}
            </div>
          )}

          {confirming === "cancel" && reservation && (
            <div className="space-y-3 border-t border-chalet-brown/20 pt-4">
              <p className="text-sm">
                Annuler cette réservation ? Les dates redeviendront libres sur le site. Le client n&apos;est pas prévenu
                automatiquement.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => perform(() => cancelReservationAction(reservation.id), true)}
                >
                  Oui, annuler la réservation
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirming(null)}>
                  Retour
                </Button>
              </div>
            </div>
          )}

          {confirming === "refuse" && reservation && (
            <div className="space-y-3 border-t border-chalet-brown/20 pt-4">
              <p className="text-sm">Refuser cette demande ?</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => perform(() => refuseRequestAction(reservation.id, true), true)}
                >
                  Refuser et prévenir le client
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => perform(() => refuseRequestAction(reservation.id, false), true)}
                >
                  Refuser sans email
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
                  Retour
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </dialog>
  );
}
