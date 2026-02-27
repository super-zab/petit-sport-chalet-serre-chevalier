import { NextRequest, NextResponse } from "next/server";
import { calculatePrice } from "@/lib/pricing";
import { getApartmentBySlug } from "@/lib/apartments";
import { getGoogleCredentials } from "@/lib/google-credentials";
import { z } from "zod";

// ADD THIS LINE RIGHT HERE:
export const dynamic = "force-dynamic";

const pricingSchema = z.object({
  apartmentSlug: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = pricingSchema.parse(body);

    const apartment = getApartmentBySlug(data.apartmentSlug);
    if (!apartment) {
      return NextResponse.json(
        { error: "Appartement introuvable" },
        { status: 404 }
      );
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Dates invalides" },
        { status: 400 }
      );
    }

    const pricing = await calculatePrice(
      data.apartmentSlug,
      startDate,
      endDate,
      apartment.defaultPrice
    );

    return NextResponse.json({
      success: true,
      pricing,
    });
  } catch (error) {
    console.error("Pricing error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue",
      },
      { status: 500 }
    );
  }
}

// Route GET pour tester la connexion au Sheet et diagnostiquer les problèmes
export async function GET(request: NextRequest) {
  try {
    const { getPricingRules, clearPricingCache, getLastDebugInfo } = await import("@/lib/pricing");
    const searchParams = request.nextUrl.searchParams;
    const clearCache = searchParams.get("clearCache") === "true";

    if (clearCache) {
      clearPricingCache();
      console.log("[API Pricing] Cache vidé");
    }

    let credentialsOk = false;
    let serviceAccountEmail: string | null = null;
    try {
      const creds = getGoogleCredentials();
      credentialsOk = true;
      serviceAccountEmail = creds.client_email;
    } catch {
      // credentials manquants ou invalides
    }

    const config = {
      hasSheetId: !!process.env.GOOGLE_SHEET_ID,
      hasCredentials: credentialsOk,
      sheetIdPreview: process.env.GOOGLE_SHEET_ID?.substring(0, 25) || "NON CONFIGURÉ",
      serviceAccountEmail,
    };

    if (!config.hasSheetId || !config.hasCredentials) {
      return NextResponse.json({
        success: false,
        error: "Configuration manquante",
        config,
        help: "Vérifiez .env.local : GOOGLE_SHEET_ID et GOOGLE_SERVICE_KEY (JSON en string) ou GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.",
      }, { status: 500 });
    }

    const rules = await getPricingRules();
    const debugInfo = getLastDebugInfo();

    const bySlug: Record<string, number> = {};
    rules.forEach((rule) => {
      bySlug[rule.apartmentSlug] = (bySlug[rule.apartmentSlug] || 0) + 1;
    });

    const message = rules.length > 0
      ? `${rules.length} règles chargées depuis le Sheet.`
      : (debugInfo?.error || "Aucune règle valide. Vérifiez la feuille et les colonnes.");

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        shareHint: "Assurez-vous que le Google Sheet est partagé avec : " + (config.serviceAccountEmail || "GOOGLE_CLIENT_EMAIL"),
      },
      debug: debugInfo || { message: "Aucune information de débogage" },
      rulesCount: rules.length,
      bySlug,
      sampleRules: rules.slice(0, 20),
      message,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Erreur inconnue");
    console.error("[API Pricing] ERREUR:", err.message);

    const errAny = error as { code?: number; message?: string };
    const is403 = errAny.code === 403 || /permission|403|access denied/i.test(errAny.message || "");
    const is404 = errAny.code === 404 || /not found|404/i.test(errAny.message || "");

    let help: string | undefined;
    if (is403) {
      help = "Le Sheet n'est peut-être pas partagé avec le compte de service. Ouvrez le Google Sheet → Partager → ajoutez l'email du compte de service (voir config.serviceAccountEmail) avec au moins « Lecteur ».";
    } else if (is404) {
      help = "Vérifiez que GOOGLE_SHEET_ID correspond bien à l'ID du document (dans l'URL : docs.google.com/spreadsheets/d/[CET_ID]/edit).";
    }

    let serviceAccountEmail: string | null = null;
    try {
      serviceAccountEmail = getGoogleCredentials().client_email;
    } catch {
      // ignore
    }
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        help,
        config: {
          hasSheetId: !!process.env.GOOGLE_SHEET_ID,
          sheetIdPreview: process.env.GOOGLE_SHEET_ID?.substring(0, 25),
          serviceAccountEmail,
        },
      },
      { status: 500 }
    );
  }
}
