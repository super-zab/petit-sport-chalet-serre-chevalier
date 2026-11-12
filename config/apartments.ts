// Contenu éditorial des appartements (textes, équipements, dossier photos).
// Les prix, disponibilités et réservations se gèrent dans le tableau de bord /admin.

export interface ApartmentConfig {
  id: string;
  slug: string;
  /** Nom court affiché dans le tableau de bord. */
  shortName: string;
  name: string;
  description: string;
  location: string; // Adresse postale
  proximityToLifts: string; // Proximité aux télésièges / remontées mécaniques
  capacity: string;
  /** Nombre maximal de voyageurs accepté par le formulaire de réservation. */
  maxGuests: number;
  amenities: string[];
  imageFolder: string; // Dossier dans public/images/
  /** Prix par nuit en euros utilisé tant que la base n'a pas été consultée. */
  defaultPrice: number;
}

export const apartmentsConfig: ApartmentConfig[] = [
  {
    id: "petit-sport-chalet-1",
    slug: "ps1",
    shortName: "Chalet 1",
    name: "Le Petit Sport Chalet 1",
    description: "1er étage de l'hôtel, 6 chambres.",
    location: "21 Route de GRENOBLE, 05240, Villeneuve la salle",
    proximityToLifts: "À proximité des télésièges",
    capacity: "Grande capacité (6 chambres)",
    maxGuests: 12,
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
    slug: "ps2",
    shortName: "Chalet 2",
    name: "Le Petit Sport Chalet 2",
    description: "2ème étage de l'hôtel, 6 chambres.",
    location: "21 Route de GRENOBLE, 05240, Villeneuve la salle",
    proximityToLifts: "À proximité des télésièges",
    capacity: "Grande capacité (6 chambres)",
    maxGuests: 12,
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
    slug: "t3",
    shortName: "Appartement Central",
    name: "L'Appartement Central",
    description: "Appartement familial (2 adultes, 3 enfants).",
    location: "Résidence l'Alpaga, 05240, Villeneuve la salle",
    proximityToLifts: "Proche des télésièges",
    capacity: "2 adultes, 3 enfants",
    maxGuests: 5,
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
