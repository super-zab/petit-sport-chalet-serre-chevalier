import { readdir } from "fs/promises";
import { join } from "path";

/**
 * Charge les images depuis un dossier dans public/images/
 * @param folder - Nom du dossier (PS1, PS2, T3, general)
 * @returns Tableau des chemins d'images
 */
export async function getImagesFromFolder(folder: string): Promise<string[]> {
  try {
    const imagesDir = join(process.cwd(), "public", "images", folder);
    const files = await readdir(imagesDir);
    
    // Filtrer uniquement les fichiers image
    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const imageFiles = files
      .filter((file) => {
        const ext = file.toLowerCase().substring(file.lastIndexOf("."));
        return imageExtensions.includes(ext);
      })
      .map((file) => `/images/${folder}/${file}`);

    // Tri personnalisé : mettre certaines images en priorité selon le dossier
    imageFiles.sort((a, b) => {
      const aName = a.split("/").pop()?.toLowerCase() || "";
      const bName = b.split("/").pop()?.toLowerCase() || "";

      // PS1 : "Chambre 1" (avec espace) en couverture, puis le reste par ordre alphabétique
      if (folder === "PS1") {
        const aIsCover = /^chambre\s*1(\s|\.|$)/i.test(aName) && !/chambre\s*1\.2/i.test(aName);
        const bIsCover = /^chambre\s*1(\s|\.|$)/i.test(bName) && !/chambre\s*1\.2/i.test(bName);
        if (aIsCover && !bIsCover) return -1;
        if (!aIsCover && bIsCover) return 1;
        if (aIsCover && bIsCover) return aName.localeCompare(bName);
        // Chambre 1.2 après Chambre 1
        const aIsChambre12 = /chambre\s*1\.2/i.test(aName);
        const bIsChambre12 = /chambre\s*1\.2/i.test(bName);
        if (aIsChambre12 && bIsChambre12) return aName.localeCompare(bName);
        if (aIsChambre12 && /chambre\s*1/i.test(bName)) return 1;
        if (bIsChambre12 && /chambre\s*1/i.test(aName)) return -1;
      }

      // PS2 : "Salon 3" avant "Salon 1"
      if (folder === "PS2") {
        const aIsSalon3 = /salon\s*3/i.test(aName);
        const bIsSalon3 = /salon\s*3/i.test(bName);
        const aIsSalon1 = /salon\s*1/i.test(aName) && !aIsSalon3;
        const bIsSalon1 = /salon\s*1/i.test(bName) && !bIsSalon3;
        
        if (aIsSalon3 && bIsSalon1) return -1;
        if (aIsSalon1 && bIsSalon3) return 1;
      }

      // T3 : salon → chambres → salles de bain (image d'accueil en tout premier si présente)
      if (folder === "T3") {
        const order = (name: string): number => {
          if (/image\s*d['\s]?accueil/i.test(name)) return 0;
          if (/salon/i.test(name)) return 1;
          if (/chambre/i.test(name)) return 2;
          if (/salle\s*de\s*bain|sdb|salle\s*bain/i.test(name)) return 3;
          return 4;
        };
        const oa = order(aName);
        const ob = order(bName);
        if (oa !== ob) return oa - ob;
      }

      // Tri alphabétique par défaut pour le reste
      return aName.localeCompare(bName);
    });

    return imageFiles;
  } catch (error) {
    console.error(`Error loading images from folder ${folder}:`, error);
    return [];
  }
}
