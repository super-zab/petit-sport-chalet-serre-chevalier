// Coordonnées publiques de l'établissement, utilisées par le site et les emails.

export const site = {
  name: "Le Petit Sport Chalet",
  contactEmail: "saslesporting@gmail.com",
  phones: [
    { href: "tel:+33612866291", label: "+33 6 12 86 62 91" },
    { href: "tel:+33612697903", label: "+33 6 12 69 79 03" },
  ],
  checkInTime: "15h00",
  checkOutTime: "10h00",
} as const;
