// Tâche planifiée (Vercel Cron) : synchronise tous les calendriers externes et fait le ménage.
// Vercel envoie automatiquement "Authorization: Bearer <CRON_SECRET>".

import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { getDb, sql } from "@/lib/db";
import { syncStaleFeeds } from "@/lib/ical";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(provided, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await syncStaleFeeds(0);
  await purgeExpiredRateLimits();
  const db = await getDb();
  await db.run(sql`DELETE FROM admin_sessions WHERE expires_at < now()`);
  return NextResponse.json({
    synced: results.length,
    failed: results.filter((result) => !result.ok).length,
  });
}
