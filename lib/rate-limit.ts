// Limitation de débit stockée en base : fonctionne même quand le site tourne
// sur plusieurs instances serverless qui ne partagent pas de mémoire.

import { headers } from "next/headers";
import { getDb, sql } from "@/lib/db";

export interface RateLimitResult {
  ok: boolean;
  /** Secondes à attendre avant de réessayer. */
  retryAfter: number;
}

/** Autorise au plus `limit` appels par fenêtre de `windowSeconds` pour une clé donnée. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const db = await getDb();
  const rows = await db.run<{ count: number; retry_after: number }>(sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}::int))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now()
        THEN now() + make_interval(secs => ${windowSeconds}::int) ELSE rate_limits.reset_at END
    RETURNING count, ceil(extract(epoch FROM reset_at - now()))::int AS retry_after
  `);
  const { count, retry_after } = rows[0];
  return { ok: count <= limit, retryAfter: Math.max(1, retry_after) };
}

export async function purgeExpiredRateLimits(): Promise<void> {
  const db = await getDb();
  await db.run(sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`);
}

/** Adresse IP du visiteur. Sur Vercel, x-forwarded-for est fixé par la plateforme, pas par le client. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "local";
}
