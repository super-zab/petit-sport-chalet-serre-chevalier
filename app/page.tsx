import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apartments } from "@/lib/apartments";
import { getImagesFromFolder } from "@/lib/images";
import { MapPin, Users, ArrowRight, Building2 } from "lucide-react";
import Image from "next/image";

export default async function Home() {
  // Charger la première image de chaque appartement (côté serveur)
  const apartmentsWithImages = await Promise.all(
    apartments.map(async (apt) => {
      const images = await getImagesFromFolder(apt.imageFolder);
      // PS1 : "Chambre 1" en couverture de la miniature
      // PS2, T3 : prioriser les photos de salon
      let firstImage: string | null = null;
      if (apt.imageFolder === "PS1") {
        const chambre1 = images.find((img) => {
          const name = (img.split("/").pop() || "").toLowerCase();
          return /^chambre\s*1(\s|\.|$)/.test(name) && !/chambre\s*1\.2/.test(name);
        });
        firstImage = chambre1 ?? images[0] ?? null;
      } else {
        const salonImages = images.filter((img) => {
          const name = img.split("/").pop() || "";
          return /salon/i.test(name);
        });
        firstImage = salonImages[0] ?? images[0] ?? null;
      }
      return { ...apt, firstImage };
    })
  );

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center">
        <div className="absolute inset-0">
          <Image
            src="/images/general/Cloture recadrée.jpeg"
            alt="Serre Chevalier - Vue panoramique sur les montagnes des Hautes-Alpes, station de ski avec remontées mécaniques"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-chalet-brown/30"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-semibold text-chalet-cream mb-6 heading-uppercase tracking-widest">
            Location Saisonnière
          </h1>
          <p className="text-xl md:text-2xl text-chalet-cream-light mb-8 font-light">
            Serre Chevalier - Vos vacances à la montagne
          </p>
          <Link
            href="#appartements"
            className={cn(buttonVariants({ size: "lg" }), "bg-chalet-brown text-chalet-cream hover:bg-chalet-brown-dark border border-chalet-brown rounded-sm")}
          >
            Découvrir nos appartements
          </Link>
        </div>
      </section>

      {/* Nos Appartements Section */}
      <section id="appartements" className="py-20 px-4 bg-chalet-cream scroll-mt-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-semibold text-center mb-16 text-chalet-brown heading-uppercase tracking-widest">
            Nos Appartements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {apartmentsWithImages.map((apartment) => (
              <Card 
                key={apartment.id} 
                className="overflow-hidden border border-chalet-brown bg-white hover:border-chalet-brown-dark transition-colors"
              >
                <div className="relative h-64 w-full border-b border-chalet-brown bg-chalet-greige">
                  {apartment.firstImage ? (
                    <Image
                      src={apartment.firstImage}
                      alt={`${apartment.name} - Location saisonnière à Serre Chevalier, ${apartment.proximityToLifts}`}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-chalet-brown/50 text-sm">
                      Aucune image
                    </div>
                  )}
                </div>
                <CardHeader className="bg-white">
                  <CardTitle className="text-chalet-brown font-semibold">{apartment.name}</CardTitle>
                  <CardDescription className="text-chalet-muted">{apartment.description}</CardDescription>
                </CardHeader>
                <CardContent className="bg-white">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-chalet-brown">
                      <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>{apartment.proximityToLifts}</span>
                    </div>
                    <div className="flex items-center text-sm text-chalet-brown">
                      <Building2 className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>{apartment.location}</span>
                    </div>
                    <div className="flex items-center text-sm text-chalet-brown">
                      <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>{apartment.capacity}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-white border-t border-chalet-brown/20">
                  <Link href={`/appartements/${apartment.slug}`} className="w-full">
                    <Button className="w-full bg-chalet-brown text-chalet-cream hover:bg-chalet-brown-dark border border-chalet-brown rounded-sm">
                      Voir disponibilités
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Localisation Section */}
      <section className="py-20 px-4 bg-chalet-cream-light border-t border-chalet-brown/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-8 text-chalet-brown heading-uppercase tracking-widest">
            Serre Chevalier
          </h2>
          <p className="text-lg text-chalet-brown/80 mb-4 font-light leading-relaxed">
            Station de ski emblématique des Hautes-Alpes, Serre Chevalier vous offre
            un domaine skiable exceptionnel et des paysages à couper le souffle.
          </p>
          <p className="text-lg text-chalet-brown/80 font-light leading-relaxed">
            Nos appartements sont idéalement situés pour profiter pleinement de votre séjour,
            à proximité des remontées mécaniques et des commerces.
          </p>
        </div>
      </section>
    </div>
  );
}
