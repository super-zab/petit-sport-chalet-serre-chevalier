"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Day } from "@/lib/dates";

interface BookingFormProps {
  apartmentSlug: string;
  maxGuests: number;
  checkIn: Day;
  checkOut: Day;
  onSuccess: () => void;
  /** Appelé quand le serveur répond que les dates viennent d'être prises. */
  onUnavailable: (message: string) => void;
}

export function BookingForm({ apartmentSlug, maxGuests, checkIn, checkOut, onSuccess, onUnavailable }: BookingFormProps) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", guests: "", website: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apartmentSlug, checkIn, checkOut, ...form }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return onSuccess();
      if (response.status === 409) return onUnavailable(data.error ?? "Ces dates ne sont plus disponibles.");
      setError(data.error ?? "Une erreur est survenue. Réessayez dans un instant.");
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nom et prénom *</Label>
        <Input id="name" type="text" required maxLength={120} autoComplete="name" value={form.name} onChange={update("name")} />
      </div>
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" required maxLength={200} autoComplete="email" value={form.email} onChange={update("email")} />
      </div>
      <div>
        <Label htmlFor="phone">Téléphone *</Label>
        <Input id="phone" type="tel" required maxLength={25} autoComplete="tel" value={form.phone} onChange={update("phone")} />
      </div>
      <div>
        <Label htmlFor="address">Adresse postale complète *</Label>
        <Input
          id="address"
          type="text"
          required
          maxLength={300}
          autoComplete="street-address"
          placeholder="Numéro, rue, code postal, ville, pays"
          value={form.address}
          onChange={update("address")}
        />
      </div>
      <div>
        <Label htmlFor="guests">Nombre de personnes * (maximum {maxGuests})</Label>
        <Input
          id="guests"
          type="number"
          inputMode="numeric"
          min={1}
          max={maxGuests}
          required
          value={form.guests}
          onChange={update("guests")}
        />
      </div>
      {/* Champ piège anti-robots : invisible et ignoré des lecteurs d'écran. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} />
      </div>
      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          "Envoyer la demande de réservation"
        )}
      </Button>
      <p className="text-xs leading-relaxed text-chalet-muted">
        Aucun paiement à cette étape. Votre demande est confirmée par email après validation par notre équipe. Vos
        coordonnées servent uniquement à traiter cette demande.
      </p>
    </form>
  );
}
