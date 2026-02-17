import { NextRequest, NextResponse } from "next/server";
import { getOccupiedDays } from "@/lib/google-calendar";
import { z } from "zod";

const availabilitySchema = z.object({
  calendarId: z.string(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = availabilitySchema.parse(body);

    if (!data.calendarId || data.calendarId.trim() === "") {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    const timeMin = data.timeMin ? new Date(data.timeMin) : new Date();
    const timeMax = data.timeMax ? new Date(data.timeMax) : undefined;

    const occupiedDays = await getOccupiedDays(data.calendarId, timeMin, timeMax);

    return NextResponse.json({
      success: true,
      occupiedDays,
    });
  } catch (error) {
    console.error("[Availability] Error:", error);
    
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
