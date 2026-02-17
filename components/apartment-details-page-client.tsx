"use client";

import { useState, useEffect } from "react";
import { Apartment } from "@/lib/apartments";
import { BookingCalendar } from "./booking-calendar";
import { BookingForm } from "./booking-form";
import { CheckCircle2, Loader2, Euro } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";

interface ApartmentDetailsPageClientProps {
  apartment: Apartment;
}

interface PricingData {
  totalPrice: number;
  pricePerNight: number;
  nights: number;
  breakdown: Array<{ date: string; price: number }>;
}

export function ApartmentDetailsPageClient({ apartment }: ApartmentDetailsPageClientProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);

  // Calculer le prix quand les dates changent
  useEffect(() => {
    if (startDate && endDate) {
      setIsLoadingPricing(true);
      fetch("/api/pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apartmentSlug: apartment.slug,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPricing(data.pricing);
          }
        })
        .catch((error) => {
          console.error("Error fetching pricing:", error);
          // En cas d'erreur, utiliser le prix par défaut
          const nights = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          setPricing({
            totalPrice: apartment.defaultPrice * nights,
            pricePerNight: apartment.defaultPrice,
            nights,
            breakdown: [],
          });
        })
        .finally(() => {
          setIsLoadingPricing(false);
        });
    } else {
      setPricing(null);
    }
  }, [startDate, endDate, apartment.slug, apartment.defaultPrice]);

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
    setShowForm(start !== null && end !== null);
  };

  const handleSuccess = () => {
    setIsSuccess(true);
    setShowForm(false);
  };

  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-16 h-16 text-chalet-brown mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2 text-chalet-brown">Demande envoyée !</h3>
        <p className="text-chalet-brown/80">
          Votre demande de réservation a été envoyée. Nous vous contacterons prochainement pour confirmer votre réservation.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BookingCalendar 
        onDateSelect={handleDateSelect} 
        calendarId={apartment.calendarId}
        apartmentSlug={apartment.slug}
      />
      
      {/* Affichage du prix */}
      {pricing && (
        <div className="mt-6 p-4 bg-chalet-cream-light border border-chalet-brown rounded-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-chalet-brown font-medium">Prix total</span>
            <span className="text-2xl font-semibold text-chalet-brown">
              {pricing.totalPrice.toFixed(2)}€
            </span>
          </div>
          <div className="text-sm text-chalet-brown/80 space-y-2">
            <div className="flex justify-between border-t border-chalet-brown/20 pt-2">
              <span>{pricing.nights} nuit{pricing.nights > 1 ? "s" : ""}</span>
              <span className="font-medium">{pricing.pricePerNight.toFixed(2)}€ / nuit</span>
            </div>
            {startDate && endDate && (
              <div className="pt-2 border-t border-chalet-brown/20 space-y-1">
                <div className="font-light">
                  Du {format(startDate, "PPP", { locale: fr })}
                </div>
                <div className="font-light">
                  Au {format(endDate, "PPP", { locale: fr })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoadingPricing && (
        <div className="mt-4 flex items-center justify-center text-chalet-brown/60">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span className="text-sm">Calcul du prix...</span>
        </div>
      )}

      {showForm && startDate && endDate && (
        <div className="mt-6 pt-6 border-t">
          <BookingForm
            apartmentId={apartment.id}
            apartmentSlug={apartment.slug}
            apartmentName={apartment.name}
            calendarId={apartment.calendarId}
            startDate={startDate}
            endDate={endDate}
            totalPrice={pricing?.totalPrice ?? null}
            onSuccess={handleSuccess}
          />
        </div>
      )}
    </div>
  );
}
