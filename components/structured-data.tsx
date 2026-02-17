import { ApartmentConfig } from "@/config/apartments";
import {
  generateHotelStructuredData,
  generateApartmentStructuredData,
  generateFAQStructuredData,
  generateBreadcrumbStructuredData,
} from "@/lib/seo";

interface StructuredDataProps {
  type: "home" | "apartment";
  apartment?: ApartmentConfig;
  images?: string[];
}

/**
 * Composant pour injecter les données structurées JSON-LD dans le <head>
 * Essentiel pour le SEO classique et le GEO (GENERATIVE ENGINE OPTIMIZATION)
 */
export function StructuredData({ type, apartment, images = [] }: StructuredDataProps) {
  let structuredData: object | object[];

  if (type === "home") {
    // Page d'accueil : Hotel + FAQ + Breadcrumb
    structuredData = [
      generateHotelStructuredData(),
      generateFAQStructuredData(),
      generateBreadcrumbStructuredData(),
    ];
  } else if (apartment) {
    // Page appartement : Product + LodgingBusiness + Breadcrumb
    structuredData = [
      generateApartmentStructuredData(apartment, images),
      generateBreadcrumbStructuredData(apartment),
    ];
  } else {
    return null;
  }

  // Si structuredData est un tableau avec un seul objet @graph, on le déstructure
  const scripts = Array.isArray(structuredData)
    ? structuredData.flatMap((data) => {
        if (data && typeof data === "object" && "@graph" in data) {
          // Cas où on a un @graph (apartment)
          return data["@graph"] as object[];
        }
        return [data];
      })
    : [structuredData];

  return (
    <>
      {scripts.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data, null, 0) }}
        />
      ))}
    </>
  );
}
