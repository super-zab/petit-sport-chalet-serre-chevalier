"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface BookingFormProps {
  apartmentId: string;
  apartmentSlug: string;
  apartmentName: string;
  calendarId: string;
  startDate: string;
  endDate: string;
  totalPrice: number | null;
  onSuccess: () => void;
}

export function BookingForm({
  apartmentId,
  apartmentSlug,
  apartmentName,
  calendarId,
  startDate,
  endDate,
  totalPrice,
  onSuccess,
}: BookingFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    guests: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Veuillez sélectionner vos dates de séjour");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apartmentId,
          apartmentSlug,
          apartmentName,
          calendarId,
          startDate,
          endDate,
          totalPrice: totalPrice ?? 0,
          ...formData,
        }),
      });

      // Vérifier si la réponse est du JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error("Le serveur a retourné une erreur. Vérifiez la console pour plus de détails.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Une erreur est survenue");
      }

      onSuccess();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Une erreur est survenue lors de l'envoi de la réservation");
      }
      console.error("Booking error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nom et prénom complets *</Label>
        <Input
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="phone">Téléphone *</Label>
        <Input
          id="phone"
          type="tel"
          required
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="address">Adresse personnelle complète *</Label>
        <Input
          id="address"
          type="text"
          required
          placeholder="Numéro, rue, code postal, ville, pays"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="guests">Nombre de personnes *</Label>
        <Input
          id="guests"
          type="number"
          min="1"
          required
          value={formData.guests}
          onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
        />
      </div>
      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting || !startDate || !endDate}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Envoi en cours...
          </>
        ) : (
          "Envoyer la demande de réservation"
        )}
      </Button>
    </form>
  );
}
