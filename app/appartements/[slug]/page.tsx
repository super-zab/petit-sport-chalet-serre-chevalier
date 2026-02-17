import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getApartmentBySlug } from "@/lib/apartments";
import { getImagesFromFolder } from "@/lib/images";
import { MapPin, Users, Check, Building2 } from "lucide-react";
import { ApartmentDetailsPageClient } from "@/components/apartment-details-page-client";
import { ImageGallery } from "@/components/image-gallery";
import { StructuredData } from "@/components/structured-data";
import { getBaseUrl } from "@/lib/seo";
import Image from "next/image";

interface PageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const apartment = getApartmentBySlug(params.slug);
  
  if (!apartment) {
    return {};
  }

  const baseUrl = getBaseUrl();
  const apartmentUrl = `${baseUrl}/appartements/${apartment.slug}`;
  const images = await getImagesFromFolder(apartment.imageFolder);
  const heroImage = images.length > 0 ? images[0] : null;
  const imageUrl = heroImage ? `${baseUrl}${heroImage}` : `${baseUrl}/images/general/Cloture recadrée.jpeg`;

  return {
    title: apartment.name,
    description: `${apartment.description} ${apartment.proximityToLifts}. ${apartment.capacity}. ${apartment.amenities.slice(0, 3).join(", ")}. Réservez votre séjour à Serre Chevalier.`,
    keywords: [
      `location ${apartment.name}`,
      `appartement ${apartment.name} Serre Chevalier`,
      apartment.location,
      apartment.proximityToLifts,
      ...apartment.amenities,
    ],
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url: apartmentUrl,
      siteName: "Le Petit Sport Chalet",
      title: `${apartment.name} - Location saisonnière Serre Chevalier`,
      description: `${apartment.description} ${apartment.proximityToLifts}. ${apartment.capacity}.`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${apartment.name} - ${apartment.description}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${apartment.name} - Location saisonnière Serre Chevalier`,
      description: `${apartment.description} ${apartment.proximityToLifts}.`,
      images: [imageUrl],
    },
    alternates: {
      canonical: apartmentUrl,
    },
  };
}

export default async function ApartmentPage({ params }: PageProps) {
  const apartment = getApartmentBySlug(params.slug);

  if (!apartment) {
    notFound();
  }

  // Charger les images depuis le dossier (aucun placeholder : on affiche un bloc si vide)
  const images = await getImagesFromFolder(apartment.imageFolder);
  const heroImage = images.length > 0 ? images[0] : null;

  // Générer un alt descriptif pour l'image hero
  const heroImageAlt = heroImage 
    ? `${apartment.name} - ${apartment.description} à Serre Chevalier`
    : `${apartment.name} - Location saisonnière Serre Chevalier`;

  return (
    <>
      <StructuredData type="apartment" apartment={apartment} images={images} />
      <div className="min-h-screen bg-chalet-cream">
      {/* Hero Header */}
      <div className="relative h-[60vh] min-h-[500px] w-full border-b border-chalet-brown bg-chalet-greige">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={heroImageAlt}
            fill
            className="object-cover"
            priority
            sizes="100vw"
            quality={85}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-chalet-brown/50">
            <span className="text-lg">Aucune image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-chalet-brown/40" />
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-semibold text-chalet-cream mb-4 heading-uppercase tracking-widest">
              {apartment.name}
            </h1>
            <p className="text-xl text-chalet-cream-light max-w-2xl font-light">
              {apartment.description}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Galerie d'images */}
        {images.length > 0 && (
          <div className="mb-12">
            <ImageGallery images={images} apartmentName={apartment.name} />
          </div>
        )}

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contenu principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* À propos */}
            <div className="bg-white border border-chalet-brown p-8 rounded-sm">
              <h2 className="text-2xl font-semibold mb-6 text-chalet-brown heading-uppercase tracking-widest">À propos</h2>
              <p className="text-chalet-brown/80 mb-6 font-light leading-relaxed">{apartment.description}</p>
              <div className="space-y-4 border-t border-chalet-brown/20 pt-6">
                <div className="flex items-center text-chalet-brown">
                  <MapPin className="w-5 h-5 mr-3 text-chalet-brown flex-shrink-0" />
                  <span>{apartment.proximityToLifts}</span>
                </div>
                <div className="flex items-center text-chalet-brown">
                  <Building2 className="w-5 h-5 mr-3 text-chalet-brown flex-shrink-0" />
                  <span>{apartment.location}</span>
                </div>
                <div className="flex items-center text-chalet-brown">
                  <Users className="w-5 h-5 mr-3 text-chalet-brown flex-shrink-0" />
                  <span>{apartment.capacity}</span>
                </div>
              </div>
            </div>

            {/* Équipements */}
            <div className="bg-white border border-chalet-brown p-8 rounded-sm">
              <h2 className="text-2xl font-semibold mb-6 text-chalet-brown heading-uppercase tracking-widest">Équipements</h2>
              <div className="grid grid-cols-2 gap-4">
                {apartment.amenities.map((amenity, index) => (
                  <div key={index} className="flex items-center">
                    <Check className="w-5 h-5 mr-2 text-chalet-brown flex-shrink-0" />
                    <span className="text-chalet-brown">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar réservation */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-chalet-brown p-6 rounded-sm sticky top-8">
              <h2 className="text-2xl font-semibold mb-6 text-chalet-brown heading-uppercase tracking-widest">Réserver</h2>
              <ApartmentDetailsPageClient apartment={apartment} />
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
