import { apartmentsConfig, getApartmentCalendarId, type ApartmentConfig } from "@/config/apartments";

export interface Apartment extends ApartmentConfig {
  calendarId: string;
  images: string[];
}

// Fonction pour obtenir un appartement avec son calendar ID
function getApartmentWithCalendarId(config: ApartmentConfig): Apartment {
  return {
    ...config,
    calendarId: getApartmentCalendarId(config.slug),
    images: [], // Sera chargé dynamiquement depuis le dossier
  };
}

export const apartments: Apartment[] = apartmentsConfig.map(getApartmentWithCalendarId);

export function getApartmentById(id: string): Apartment | undefined {
  return apartments.find((apt) => apt.id === id);
}

export function getApartmentBySlug(slug: string): Apartment | undefined {
  return apartments.find((apt) => apt.slug === slug);
}

// Fonction pour charger les images depuis le dossier public/images/[folder]
export function getApartmentImages(folder: string): string[] {
  // Cette fonction sera utilisée côté serveur pour lister les fichiers
  // Pour l'instant, retourne un tableau vide qui sera rempli dynamiquement
  return [];
}
