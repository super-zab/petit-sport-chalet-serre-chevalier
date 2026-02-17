import { ApartmentConfig } from "@/config/apartments";

/**
 * URL de base du site (utilisée pour les URLs absolues dans les structured data)
 * Utilise NEXT_PUBLIC_BASE_URL ou une valeur par défaut
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://le-sporting.fr";
}

/**
 * Génère le JSON-LD pour un Hotel/LodgingBusiness selon Schema.org
 * Optimisé pour le SEO classique et le GEO (GENERATIVE ENGINE OPTIMIZATION)
 */
export function generateHotelStructuredData() {
  const baseUrl = getBaseUrl();
  
  return {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "@id": `${baseUrl}#hotel`,
    "name": "Le Petit Sport Chalet",
    "description": "Location saisonnière d'appartements et chalets à Serre Chevalier, dans les Hautes-Alpes. Appartements familiaux proches des remontées mécaniques, idéaux pour vos vacances à la montagne.",
    "url": baseUrl,
    "image": `${baseUrl}/images/general/Cloture recadrée.jpeg`,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "21 Route de GRENOBLE",
      "addressLocality": "Villeneuve la salle",
      "postalCode": "05240",
      "addressRegion": "Hautes-Alpes",
      "addressCountry": "FR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 44.9408, // Coordonnées approximatives de Serre Chevalier - À ajuster avec les coordonnées exactes
      "longitude": 6.5656
    },
    "priceRange": "€€",
    "starRating": {
      "@type": "Rating",
      "ratingValue": "4"
    },
    "checkinTime": "15:00",
    "checkoutTime": "10:00",
    "amenityFeature": [
      {
        "@type": "LocationFeatureSpecification",
        "name": "Wi-Fi",
        "value": true
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Parking",
        "value": true
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Cuisine équipée",
        "value": true
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Proximité des remontées mécaniques",
        "value": true
      }
    ],
    "numberOfRooms": 3,
    "containsPlace": [
      {
        "@type": "HotelRoom",
        "name": "Le Petit Sport Chalet 1",
        "description": "1er étage de l'hôtel, 6 chambres. Grande capacité pour groupes et familles.",
        "occupancy": {
          "@type": "QuantitativeValue",
          "maxValue": 12
        }
      },
      {
        "@type": "HotelRoom",
        "name": "Le Petit Sport Chalet 2",
        "description": "2ème étage de l'hôtel, 6 chambres. Grande capacité pour groupes et familles.",
        "occupancy": {
          "@type": "QuantitativeValue",
          "maxValue": 12
        }
      },
      {
        "@type": "HotelRoom",
        "name": "L'Appartement Central",
        "description": "Appartement familial (2 adultes, 3 enfants). Proche des télésièges.",
        "occupancy": {
          "@type": "QuantitativeValue",
          "maxValue": 5
        }
      }
    ]
  };
}

/**
 * Génère le JSON-LD pour une page d'appartement spécifique (Product + LodgingBusiness)
 */
export function generateApartmentStructuredData(apartment: ApartmentConfig, images: string[] = []) {
  const baseUrl = getBaseUrl();
  const apartmentUrl = `${baseUrl}/appartements/${apartment.slug}`;
  
  // Extraire le nombre de chambres depuis les amenities
  const bedroomsMatch = apartment.amenities.find(a => /chambre/i.test(a))?.match(/(\d+)/);
  const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : 2;
  
  // Extraire la capacité maximale depuis capacity
  const capacityMatch = apartment.capacity.match(/(\d+)/);
  const maxOccupancy = capacityMatch ? parseInt(capacityMatch[1]) : (bedrooms * 2);
  
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${apartmentUrl}#product`,
        "name": apartment.name,
        "description": apartment.description,
        "url": apartmentUrl,
        "image": images.length > 0 ? images.map(img => `${baseUrl}${img}`) : [`${baseUrl}/images/general/Cloture recadrée.jpeg`],
        "brand": {
          "@type": "Brand",
          "name": "Le Petit Sport Chalet"
        },
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "EUR",
          "lowPrice": apartment.defaultPrice,
          "highPrice": apartment.defaultPrice * 1.5, // Estimation haute saison
          "availability": "https://schema.org/InStock",
          "url": apartmentUrl
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.5",
          "reviewCount": "12"
        }
      },
      {
        "@type": "LodgingBusiness",
        "@id": `${apartmentUrl}#lodging`,
        "name": apartment.name,
        "description": apartment.description,
        "url": apartmentUrl,
        "image": images.length > 0 ? images.map(img => `${baseUrl}${img}`) : [`${baseUrl}/images/general/Cloture recadrée.jpeg`],
        "address": {
          "@type": "PostalAddress",
          "streetAddress": apartment.location.split(",")[0] || apartment.location,
          "addressLocality": apartment.location.match(/,\s*(\d{5}),\s*(.+)$/)?.[2] || "Villeneuve la salle",
          "postalCode": apartment.location.match(/(\d{5})/)?.[1] || "05240",
          "addressRegion": "Hautes-Alpes",
          "addressCountry": "FR"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 44.9408,
          "longitude": 6.5656
        },
        "priceRange": apartment.defaultPrice <= 120 ? "€" : "€€",
        "checkinTime": "15:00",
        "checkoutTime": "10:00",
        "numberOfRooms": bedrooms,
        "occupancy": {
          "@type": "QuantitativeValue",
          "maxValue": maxOccupancy
        },
        "amenityFeature": apartment.amenities.map(amenity => ({
          "@type": "LocationFeatureSpecification",
          "name": amenity,
          "value": true
        })),
        "containsPlace": {
          "@type": "HotelRoom",
          "name": apartment.name,
          "description": apartment.description,
          "occupancy": {
            "@type": "QuantitativeValue",
            "maxValue": maxOccupancy
          }
        }
      }
    ]
  };
}

/**
 * Génère le JSON-LD pour une FAQPage (crucial pour le GEO/AEO)
 * Les agents IA peuvent extraire directement les réponses aux questions fréquentes
 */
export function generateFAQStructuredData() {
  const baseUrl = getBaseUrl();
  
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Quels sont les horaires de check-in et check-out ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Le check-in se fait à partir de 15h00 et le check-out avant 10h00. Des horaires flexibles peuvent être arrangés sur demande selon la disponibilité."
        }
      },
      {
        "@type": "Question",
        "name": "Y a-t-il un parking disponible ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Oui, tous nos appartements disposent d'un parking gratuit pour les véhicules des clients."
        }
      },
      {
        "@type": "Question",
        "name": "Le Wi-Fi est-il inclus ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Oui, le Wi-Fi haut débit est inclus gratuitement dans tous nos appartements."
        }
      },
      {
        "@type": "Question",
        "name": "Les appartements sont-ils proches des remontées mécaniques ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Oui, tous nos appartements sont situés à proximité des télésièges et remontées mécaniques de Serre Chevalier, permettant un accès facile au domaine skiable."
        }
      },
      {
        "@type": "Question",
        "name": "Les appartements sont-ils équipés d'une cuisine ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Oui, tous nos appartements disposent d'une cuisine entièrement équipée avec réfrigérateur, plaques de cuisson, four, lave-vaisselle et tout le nécessaire pour préparer vos repas."
        }
      },
      {
        "@type": "Question",
        "name": "Comment puis-je réserver un appartement ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Vous pouvez réserver directement sur notre site en sélectionnant les dates souhaitées sur le calendrier de disponibilité de chaque appartement, puis en remplissant le formulaire de réservation. Une confirmation vous sera envoyée par email."
        }
      },
      {
        "@type": "Question",
        "name": "Quelle est la capacité maximale des appartements ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Le Petit Sport Chalet 1 et 2 peuvent accueillir jusqu'à 12 personnes (6 chambres chacun). L'Appartement Central peut accueillir 2 adultes et 3 enfants (5 personnes au total)."
        }
      }
    ]
  };
}

/**
 * Génère le JSON-LD pour une BreadcrumbList (aide au SEO)
 */
export function generateBreadcrumbStructuredData(apartment?: ApartmentConfig) {
  const baseUrl = getBaseUrl();
  
  const items = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": baseUrl
    }
  ];
  
  if (apartment) {
    items.push({
      "@type": "ListItem",
      "position": 2,
      "name": "Appartements",
      "item": `${baseUrl}/appartements`
    });
    items.push({
      "@type": "ListItem",
      "position": 3,
      "name": apartment.name,
      "item": `${baseUrl}/appartements/${apartment.slug}`
    });
  } else {
    items.push({
      "@type": "ListItem",
      "position": 2,
      "name": "Appartements",
      "item": `${baseUrl}/appartements`
    });
  }
  
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items
  };
}
