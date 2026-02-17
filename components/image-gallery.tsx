"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Affiche une image ; en cas d'échec appelle onError et ne rend rien (pas de message "Image indisponible"). */
function SafeImage({
  src,
  alt,
  fill,
  className,
  sizes,
  quality,
  priority,
  loading,
  onError,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  loading?: "eager" | "lazy";
  onError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const handleError = useCallback(() => {
    setFailed(true);
    onError?.();
  }, [onError]);
  if (failed) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      quality={quality}
      priority={priority}
      loading={loading}
      onError={handleError}
      unoptimized
    />
  );
}

interface ImageGalleryProps {
  images: string[];
  apartmentName: string;
}

/**
 * Génère un alt text descriptif basé sur le nom du fichier image
 * Optimisé pour le SEO et l'accessibilité
 */
function generateImageAlt(imagePath: string, apartmentName: string, index: number): string {
  const fileName = imagePath.split("/").pop() || "";
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").toLowerCase();
  
  // Détecter le type de pièce/photo depuis le nom
  let roomType = "";
  if (/salon/i.test(nameWithoutExt)) {
    roomType = "Salon";
  } else if (/chambre\s*1/i.test(nameWithoutExt) && !/chambre\s*1\.2/i.test(nameWithoutExt)) {
    roomType = "Chambre principale";
  } else if (/chambre/i.test(nameWithoutExt)) {
    roomType = "Chambre";
  } else if (/cuisine/i.test(nameWithoutExt)) {
    roomType = "Cuisine";
  } else if (/salle\s*de\s*bain|sdb/i.test(nameWithoutExt)) {
    roomType = "Salle de bain";
  } else if (/image\s*d['\s]?accueil/i.test(nameWithoutExt)) {
    roomType = "Vue d'ensemble";
  } else {
    roomType = "Intérieur";
  }
  
  return `${apartmentName} - ${roomType} à Serre Chevalier`;
}

export function ImageGallery({ images, apartmentName }: ImageGalleryProps) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const visibleImages = useMemo(
    () => images.filter((src) => !failedUrls.has(src)),
    [images, failedUrls]
  );
  const markFailed = useCallback((url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  if (visibleImages.length === 0) {
    return (
      <div className="relative w-full h-96 bg-chalet-cream-light border border-chalet-brown rounded-sm flex items-center justify-center">
        <p className="text-chalet-muted">Aucune image disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image principale */}
      <div className="relative w-full aspect-video rounded-sm overflow-hidden bg-chalet-cream-light border border-chalet-brown">
        <div className="embla" ref={emblaRef} key={visibleImages.length}>
          <div className="embla__container">
            {visibleImages.map((image, index) => (
              <div key={image} className="embla__slide flex-[0_0_100%]">
                <div className="relative w-full h-full min-h-[400px]">
                  <SafeImage
                    src={image}
                    alt={`${apartmentName} - Image ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                    sizes="100vw"
                    quality={85}
                    loading={index === 0 ? "eager" : "lazy"}
                    onError={() => markFailed(image)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Boutons de navigation */}
        {visibleImages.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-chalet-cream/90 hover:bg-chalet-cream border-chalet-brown"
              onClick={scrollPrev}
              disabled={!canScrollPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-chalet-cream/90 hover:bg-chalet-cream border-chalet-brown"
              onClick={scrollNext}
              disabled={!canScrollNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Indicateur de position */}
        {visibleImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
            {visibleImages.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={cn(
                  "h-1 rounded-full transition-all",
                  index === selectedIndex
                    ? "bg-chalet-cream w-8"
                    : "bg-chalet-cream/50 hover:bg-chalet-cream/75 w-2"
                )}
                aria-label={`Aller à l'image ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Miniatures */}
      {visibleImages.length > 1 && (
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
          {visibleImages.map((image, index) => (
            <button
              key={image}
              onClick={() => scrollTo(index)}
              className={cn(
                "relative aspect-video rounded-sm overflow-hidden border transition-all",
                index === selectedIndex
                  ? "border-chalet-brown border-2"
                  : "border-chalet-brown/30 hover:border-chalet-brown/60"
              )}
            >
              <SafeImage
                src={image}
                alt={`Miniature: ${generateImageAlt(image, apartmentName, index)}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 25vw, 16vw"
                quality={75}
                loading="lazy"
                onError={() => markFailed(image)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
