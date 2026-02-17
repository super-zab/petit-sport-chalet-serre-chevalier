"use client";

import { useState } from "react";
import { Apartment } from "@/lib/apartments";
import { BookingCalendar } from "./booking-calendar";
import { BookingForm } from "./booking-form";
import { CheckCircle2 } from "lucide-react";

interface ApartmentDetailsClientProps {
  apartment: Apartment;
}

export function ApartmentDetailsClient({ apartment }: ApartmentDetailsClientProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
        <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Demande envoyée !</h3>
        <p className="text-gray-600">
          Votre demande de réservation a été envoyée. Nous vous contacterons prochainement pour confirmer votre réservation.
          une fois que nous aurons validé votre demande.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BookingCalendar onDateSelect={handleDateSelect} />
      {showForm && startDate && endDate && (
        <div className="mt-6 pt-6 border-t">
          <BookingForm
            apartmentId={apartment.id}
            apartmentName={apartment.name}
            startDate={startDate}
            endDate={endDate}
            onSuccess={handleSuccess}
          />
        </div>
      )}
    </div>
  );
}
