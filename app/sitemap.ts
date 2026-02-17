import { MetadataRoute } from "next";
import { apartments } from "@/lib/apartments";
import { getBaseUrl } from "@/lib/seo";

/**
 * Génère dynamiquement le sitemap.xml pour le SEO
 * Inclut toutes les pages importantes du site
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const currentDate = new Date();

  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];

  // Pages d'appartements (dynamiques)
  const apartmentPages: MetadataRoute.Sitemap = apartments.map((apartment) => ({
    url: `${baseUrl}/appartements/${apartment.slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...apartmentPages];
}
