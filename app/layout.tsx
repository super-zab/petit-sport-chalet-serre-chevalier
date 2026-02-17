import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { StructuredData } from "@/components/structured-data";
import { getBaseUrl } from "@/lib/seo";

const montserrat = Montserrat({ 
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700"],
});

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Le Petit Sport Chalet - Location saisonnière Serre Chevalier",
    template: "%s | Le Petit Sport Chalet",
  },
  description: "Location saisonnière d'appartements et chalets à Serre Chevalier, Hautes-Alpes. Appartements familiaux proches des remontées mécaniques, idéaux pour vos vacances à la montagne. Wi-Fi, parking, cuisine équipée.",
  keywords: [
    "location saisonnière Serre Chevalier",
    "appartement Serre Chevalier",
    "chalet location Hautes-Alpes",
    "location vacances montagne",
    "appartement ski Serre Chevalier",
    "location proche télésièges",
    "Villeneuve la salle location",
  ],
  authors: [{ name: "Le Petit Sport Chalet" }],
  creator: "Le Petit Sport Chalet",
  publisher: "Le Petit Sport Chalet",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: baseUrl,
    siteName: "Le Petit Sport Chalet",
    title: "Le Petit Sport Chalet - Location saisonnière Serre Chevalier",
    description: "Location saisonnière d'appartements et chalets à Serre Chevalier, Hautes-Alpes. Appartements familiaux proches des remontées mécaniques.",
    images: [
      {
        url: `${baseUrl}/images/general/Cloture recadrée.jpeg`,
        width: 1200,
        height: 630,
        alt: "Serre Chevalier - Vue sur les montagnes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Le Petit Sport Chalet - Location saisonnière Serre Chevalier",
    description: "Location saisonnière d'appartements et chalets à Serre Chevalier, Hautes-Alpes.",
    images: [`${baseUrl}/images/general/Cloture recadrée.jpeg`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: baseUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body className="bg-chalet-cream text-chalet-brown antialiased">
        <StructuredData type="home" />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
