import { NextRequest, NextResponse } from "next/server";
import { getPricesForRange } from "@/lib/pricing";
import { getApartmentBySlug } from "@/lib/apartments";
import { z } from "zod";

const schema = z.object({
  apartmentSlug: z.string(),
  timeMin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeMax: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = schema.parse(body);

    const apartment = getApartmentBySlug(data.apartmentSlug);
    if (!apartment) {
      return NextResponse.json(
        { error: "Appartement introuvable" },
        { status: 404 }
      );
    }

    const prices = await getPricesForRange(
      data.apartmentSlug,
      data.timeMin,
      data.timeMax,
      apartment.defaultPrice
    );

    return NextResponse.json({ success: true, prices });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
