// Configuration des appartements
// Les Calendar IDs doivent être définis dans .env.local

export interface ApartmentConfig {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string; // Adresse postale
  proximityToLifts: string; // Proximité aux télésièges / remontées mécaniques
  capacity: string;
  amenities: string[];
  imageFolder: string; // Dossier dans public/images/
  defaultPrice: number; // Prix par défaut par nuit en euros
  // calendarId sera chargé depuis les variables d'environnement
}

export const apartmentsConfig: ApartmentConfig[] = [
  {
    id: "petit-sport-chalet-1",
    slug: "ps1", // Slug utilisé dans Google Sheets
    name: "Le Petit Sport Chalet 1",
    description: "1er étage de l'hôtel, 6 chambres.",
    location: "21 Route de GRENOBLE, 05240, Villeneuve la salle",
    proximityToLifts: "À proximité des télésièges",
    capacity: "Grande capacité (6 chambres)",
    amenities: [
      "6 chambres",
      "Cuisine équipée",
      "Salle de bain",
      "Wi-Fi",
      "Parking",
      "Vue montagne",
    ],
    imageFolder: "PS1",
    defaultPrice: 150,
  },
  {
    id: "petit-sport-chalet-2",
    slug: "ps2", // Slug utilisé dans Google Sheets
    name: "Le Petit Sport Chalet 2",
    description: "2ème étage de l'hôtel, 6 chambres.",
    location: "21 Route de GRENOBLE, 05240, Villeneuve la salle",
    proximityToLifts: "À proximité des télésièges",
    capacity: "Grande capacité (6 chambres)",
    amenities: [
      "6 chambres",
      "Cuisine équipée",
      "Salle de bain",
      "Wi-Fi",
      "Parking",
      "Vue montagne",
    ],
    imageFolder: "PS2",
    defaultPrice: 150,
  },
  {
    id: "appartement-central",
    slug: "t3", // Slug utilisé dans Google Sheets
    name: "L'Appartement Central",
    description: "Appartement familial (2 adultes, 3 enfants).",
    location: "Résidence l'Alpaga, 05240, Villeneuve la salle",
    proximityToLifts: "Proche des télésièges",
    capacity: "2 adultes, 3 enfants",
    amenities: [
      "2 chambres",
      "Cuisine équipée",
      "Salle de bain",
      "Wi-Fi",
      "Parking",
      "Proche des remontées mécaniques",
    ],
    imageFolder: "T3",
    defaultPrice: 120,
  },
];

// Fonction pour obtenir le calendar ID d'un appartement
export function getApartmentCalendarId(slug: string): string {
  const calendarIds: Record<string, string> = {
    "ps1": process.env.GOOGLE_CALENDAR_ID_PS1 || "",
    "ps2": process.env.GOOGLE_CALENDAR_ID_PS2 || "",
    "t3": process.env.GOOGLE_CALENDAR_ID_T3 || "",
  };
  return calendarIds[slug] || "";
}
