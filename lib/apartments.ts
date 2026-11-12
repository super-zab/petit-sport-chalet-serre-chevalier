import { apartmentsConfig, type ApartmentConfig } from "@/config/apartments";

export type Apartment = ApartmentConfig;

export const apartments: Apartment[] = apartmentsConfig;

export function getApartmentBySlug(slug: string): Apartment | undefined {
  return apartments.find((apt) => apt.slug === slug);
}

export function isApartmentSlug(slug: unknown): slug is string {
  return typeof slug === "string" && apartments.some((apt) => apt.slug === slug);
}
