import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { getGoogleCredentials } from "@/lib/google-credentials";

export interface PricingRule {
  date: string; // Format: YYYY-MM-DD
  apartmentSlug: string; // ps1, ps2, t3
  price: number; // Prix par nuit en euros
}

/**
 * Initialise la connexion au Google Sheet
 */
async function getSpreadsheet() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("GOOGLE_SHEET_ID is not configured");
  }

  const { client_email, private_key } = getGoogleCredentials();
  const serviceAccountAuth = new JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

// Cache pour les règles de pricing (5 minutes)
let pricingCache: { rules: PricingRule[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère toutes les règles de pricing depuis le Google Sheet
 * Lit uniquement la feuille "DB_EXPORT"
 * Utilise un cache pour éviter les requêtes répétées
 */
// Interface pour les informations de débogage
export interface PricingDebugInfo {
  sheetCount?: number;
  sheetNames?: string[];
  usedSheet?: string;
  headers?: string[];
  rowCount?: number;
  sampleRows?: Array<{ date_iso: any; apartment_slug: any; price: any }>;
  error?: string;
}

// Variable globale pour stocker les infos de débogage
let lastDebugInfo: PricingDebugInfo | null = null;

export function getLastDebugInfo(): PricingDebugInfo | null {
  return lastDebugInfo;
}

export async function getPricingRules(): Promise<PricingRule[]> {
  // Réinitialiser les infos de débogage
  lastDebugInfo = {};
  
  // Vérifier le cache
  if (pricingCache && Date.now() - pricingCache.timestamp < CACHE_DURATION) {
    console.log(`[Pricing] Utilisation du cache (${pricingCache.rules.length} règles)`);
    return pricingCache.rules;
  }

  try {
    console.log("[Pricing] Début du chargement depuis Google Sheets...");
    
    // Vérifier la configuration
    if (!process.env.GOOGLE_SHEET_ID) {
      throw new Error("GOOGLE_SHEET_ID n'est pas configuré dans .env.local");
    }
    getGoogleCredentials(); // vérifie que les credentials sont configurés
    console.log(`[Pricing] Sheet ID: ${process.env.GOOGLE_SHEET_ID.substring(0, 20)}...`);
    
    const doc = await getSpreadsheet();
    const sheetCount = doc.sheetCount;
    console.log(`[Pricing] Sheet chargé, ${sheetCount} feuille(s) trouvée(s)`);
    lastDebugInfo.sheetCount = sheetCount;
    
    // Lister toutes les feuilles disponibles
    const sheetNames = Object.keys(doc.sheetsByTitle);
    console.log(`[Pricing] Feuilles disponibles: ${sheetNames.join(", ")}`);
    lastDebugInfo.sheetNames = sheetNames;
    
    // Chercher la feuille "DB_EXPORT" (ou première feuille)
    let sheet = doc.sheetsByTitle["DB_EXPORT"] ?? doc.sheetsByTitle["DB_EXPORT "] ?? doc.sheetsByTitle["db_export"];
    if (!sheet) {
      sheet = doc.sheetsByIndex[0];
      if (sheet) {
        console.warn(`[Pricing] Feuille "DB_EXPORT" absente, utilisation de la première feuille: "${sheet.title}"`);
      }
    }
    if (!sheet) {
      const error = `Aucune feuille trouvée. Feuilles disponibles: ${sheetNames.join(", ")}`;
      lastDebugInfo.error = error;
      throw new Error(error);
    }

    console.log(`[Pricing] Utilisation de la feuille: "${sheet.title}"`);
    lastDebugInfo.usedSheet = sheet.title;

    await sheet.loadHeaderRow();
    const headers: string[] = sheet.headerValues || [];
    console.log(`[Pricing] En-têtes trouvés: ${headers.join(", ")}`);
    lastDebugInfo.headers = headers;

    // Associer nos clés aux noms d'en-têtes réels (insensible à la casse et aux espaces)
    const normalize = (s: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, "_");
    const headerMap: Record<string, string> = {};
    const required: Record<string, string[]> = {
      date_iso: ["date_iso", "date iso", "dateiso", "date"],
      apartment_slug: ["apartment_slug", "apartment slug", "apartement", "slug", "appartment_slug"],
      price: ["price", "prix"],
    };
    for (const [key, candidates] of Object.entries(required)) {
      const found = headers.find((h) => candidates.includes(normalize(h)));
      if (found) {
        headerMap[key] = found;
      }
    }
    const missing = Object.keys(required).filter((k) => !headerMap[k]);
    if (missing.length > 0) {
      const error = `Colonnes manquantes ou non reconnues: ${missing.join(", ")}. En-têtes du Sheet: ${headers.join(", ")}. Attendu: date_iso (ou "date iso"), apartment_slug (ou "apartment slug"), price (ou "prix").`;
      lastDebugInfo.error = error;
      throw new Error(error);
    }

    const rows = await sheet.getRows();
    const rowCount = rows.length;
    console.log(`[Pricing] ${rowCount} lignes trouvées dans la feuille`);
    lastDebugInfo.rowCount = rowCount;

    const rules: PricingRule[] = [];
    let skippedRows = 0;
    const sampleRows: Array<{ date_iso: any; apartment_slug: any; price: any }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dateIso = row.get(headerMap.date_iso);
      const apartmentSlug = row.get(headerMap.apartment_slug);
      const price = row.get(headerMap.price);

      // Stocker les premières lignes pour déboguer
      if (i < 5) {
        sampleRows.push({
          date_iso: dateIso,
          apartment_slug: apartmentSlug,
          price: price,
        });
        console.log(`[Pricing] Ligne ${i + 1}: date_iso="${dateIso}", apartment_slug="${apartmentSlug}", price="${price}"`);
      }

      if (dateIso && apartmentSlug && price !== undefined && price !== null) {
        // Parser la date comme string (YYYY-MM-DD)
        const dateStr = String(dateIso).trim();
        const slug = String(apartmentSlug).trim().toLowerCase();
        const priceNum = Number(price);

        if (dateStr && slug && !isNaN(priceNum) && priceNum > 0) {
          rules.push({
            date: dateStr,
            apartmentSlug: slug,
            price: priceNum,
          });
        } else {
          skippedRows++;
          if (i < 5) {
            console.warn(`[Pricing] Ligne ${i + 1} ignorée: date="${dateIso}" (${dateStr}), slug="${apartmentSlug}" (${slug}), price="${price}" (${priceNum})`);
          }
        }
      } else {
        skippedRows++;
        if (i < 5) {
          console.warn(`[Pricing] Ligne ${i + 1} ignorée (valeurs manquantes): date_iso=${dateIso}, apartment_slug=${apartmentSlug}, price=${price}`);
        }
      }
    }

    lastDebugInfo.sampleRows = sampleRows;

    console.log(`[Pricing] ${rules.length} règles valides chargées, ${skippedRows} lignes ignorées`);
    if (rules.length > 0) {
      console.log(`[Pricing] Exemple de règles:`, rules.slice(0, 3));
    } else {
      const error = `AUCUNE règle valide trouvée ! ${rowCount} lignes lues, ${skippedRows} ignorées. Vérifiez le format des données.`;
      console.error(`[Pricing] ${error}`);
      lastDebugInfo.error = error;
    }

    // Mettre en cache
    pricingCache = {
      rules,
      timestamp: Date.now(),
    };

    return rules;
  } catch (error) {
    console.error("[Pricing] ERREUR lors du chargement:", error);
    if (error instanceof Error) {
      console.error("[Pricing] Message d'erreur:", error.message);
      console.error("[Pricing] Stack:", error.stack);
      lastDebugInfo.error = error.message;
    }
    // Retourner le cache si disponible, sinon tableau vide
    const cachedRules = pricingCache?.rules || [];
    if (cachedRules.length > 0) {
      console.warn(`[Pricing] Utilisation du cache en cas d'erreur (${cachedRules.length} règles)`);
    }
    return cachedRules;
  }
}

/**
 * Calcule le prix total pour une période donnée
 * @param apartmentSlug - Slug de l'appartement
 * @param startDate - Date de début (Date object)
 * @param endDate - Date de fin (Date object)
 * @param defaultPrice - Prix par défaut par nuit
 */
export async function calculatePrice(
  apartmentSlug: string,
  startDate: Date,
  endDate: Date,
  defaultPrice: number
): Promise<{ totalPrice: number; pricePerNight: number; nights: number; breakdown: Array<{ date: string; price: number }> }> {
  // Normaliser le slug en minuscules
  const normalizedSlug = apartmentSlug.toLowerCase().trim();
  console.log(`[Pricing] Calcul pour slug: "${normalizedSlug}", prix par défaut: ${defaultPrice}€`);
  
  const rules = await getPricingRules();
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Filtrer les règles pour cet appartement
  const relevantRules = rules.filter(r => r.apartmentSlug === normalizedSlug);
  console.log(`[Pricing] ${relevantRules.length} règles trouvées pour "${normalizedSlug}"`);
  
  const breakdown: Array<{ date: string; price: number }> = [];
  let totalPrice = 0;
  let matchedCount = 0;

  // Pour chaque nuit
  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // Chercher une règle qui correspond exactement (date + slug)
    let priceForNight = defaultPrice;
    for (const rule of relevantRules) {
      if (rule.date === dateStr) {
        priceForNight = rule.price;
        matchedCount++;
        console.log(`[Pricing] Date ${dateStr}: ${rule.price}€ (trouvé dans Sheet)`);
        break;
      }
    }
    
    if (priceForNight === defaultPrice) {
      console.log(`[Pricing] Date ${dateStr}: ${defaultPrice}€ (prix par défaut)`);
    }

    breakdown.push({
      date: dateStr,
      price: priceForNight,
    });
    totalPrice += priceForNight;
  }

  console.log(`[Pricing] Résultat: ${matchedCount}/${nights} dates avec prix du Sheet, total: ${totalPrice}€`);

  const pricePerNight = nights > 0 ? totalPrice / nights : defaultPrice;

  return {
    totalPrice,
    pricePerNight,
    nights,
    breakdown,
  };
}

/**
 * Retourne le prix par nuit pour chaque jour dans une plage (YYYY-MM-DD → prix).
 * Utilisé pour afficher les prix sur le calendrier.
 */
export async function getPricesForRange(
  apartmentSlug: string,
  dateMin: string,
  dateMax: string,
  defaultPrice: number
): Promise<Record<string, number>> {
  const normalizedSlug = apartmentSlug.toLowerCase().trim();
  const rules = await getPricingRules();
  const relevantRules = rules.filter((r) => r.apartmentSlug === normalizedSlug);
  const byDate = new Map<string, number>();
  for (const r of relevantRules) {
    byDate.set(r.date, r.price);
  }

  const result: Record<string, number> = {};
  const start = new Date(dateMin + "T12:00:00");
  const end = new Date(dateMax + "T12:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    result[dateStr] = byDate.get(dateStr) ?? defaultPrice;
  }
  return result;
}

// Fonction pour vider le cache (utile pour le débogage)
export function clearPricingCache() {
  pricingCache = null;
  console.log("[Pricing] Cache vidé");
}
