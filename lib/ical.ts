// Synchronisation avec les autres plateformes (Airbnb, Booking.com…) par calendriers iCal.
// Import : leurs réservations bloquent nos dates. Export : nos réservations bloquent les leurs.

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { getApartmentBySlug } from "@/lib/apartments";
import { getDb, sql } from "@/lib/db";
import { addDays, todayParis } from "@/lib/dates";
import { buildIcal, parseIcal, type IcalEvent } from "@/lib/ical-parse";

const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

// Adresses internes : un lien iCal ne doit jamais permettre d'interroger le réseau privé du serveur.
const privateRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127], ["64:ff9b::", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv6");
}

function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return privateRanges.check(mapped[1], "ipv4");
  return privateRanges.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

export class FeedError extends Error {}

/** Vérifie la forme d'un lien iCal. Renvoie l'URL normalisée ou lève une FeedError. */
export function validateFeedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcal:/i, "https:"));
  } catch {
    throw new FeedError("Ce lien n'est pas une adresse valide.");
  }
  if (url.protocol !== "https:") throw new FeedError("Le lien doit commencer par https://");
  if (url.username || url.password) throw new FeedError("Le lien ne doit pas contenir d'identifiants.");
  if (url.port && url.port !== "443") throw new FeedError("Ce lien utilise un port non autorisé.");
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0 || !url.hostname.includes(".")) {
    throw new FeedError("Le lien doit pointer vers un nom de domaine public.");
  }
  return url;
}

async function assertPublicHost(url: URL): Promise<void> {
  const addresses = await lookup(url.hostname, { all: true }).catch(() => {
    throw new FeedError("Nom de domaine introuvable.");
  });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new FeedError("Ce lien pointe vers une adresse non autorisée.");
  }
}

async function fetchCalendarText(rawUrl: string): Promise<string> {
  let url = validateFeedUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "text/calendar, text/plain;q=0.8", "User-Agent": "calendar-sync/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new FeedError("Redirection invalide.");
      url = validateFeedUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new FeedError(`La plateforme a répondu avec une erreur (${response.status}).`);
    if (!response.body) throw new FeedError("Réponse vide.");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new FeedError("Calendrier trop volumineux.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new FeedError("Trop de redirections.");
}

export interface Feed {
  id: string;
  apartmentSlug: string;
  name: string;
  url: string;
  lastSyncedAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
}

type FeedRow = {
  id: string;
  apartment_slug: string;
  name: string;
  url: string;
  last_synced_at: Date | null;
  last_ok_at: Date | null;
  last_error: string | null;
};

function mapFeed(row: FeedRow): Feed {
  return {
    id: row.id,
    apartmentSlug: row.apartment_slug,
    name: row.name,
    url: row.url,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
    lastOkAt: row.last_ok_at ? new Date(row.last_ok_at).toISOString() : null,
    lastError: row.last_error,
  };
}

export async function listFeeds(): Promise<Feed[]> {
  const db = await getDb();
  return (await db.run<FeedRow>(sql`SELECT * FROM ical_feeds ORDER BY apartment_slug, created_at`)).map(mapFeed);
}

export async function addFeed(apartmentSlug: string, name: string, rawUrl: string): Promise<Feed> {
  const url = validateFeedUrl(rawUrl);
  const db = await getDb();
  const rows = await db.run<FeedRow>(sql`
    INSERT INTO ical_feeds (apartment_slug, name, url) VALUES (${apartmentSlug}, ${name}, ${url.toString()}) RETURNING *
  `);
  return mapFeed(rows[0]);
}

export async function removeFeed(id: string): Promise<void> {
  const db = await getDb();
  await db.run(sql`DELETE FROM ical_feeds WHERE id = ${id}::uuid`);
}

export interface SyncResult {
  feedId: string;
  ok: boolean;
  events: number;
  error: string | null;
}

/** Télécharge un calendrier externe et remplace ses périodes d'occupation en base. */
export async function syncFeed(feed: Pick<Feed, "id" | "apartmentSlug" | "url">): Promise<SyncResult> {
  const db = await getDb();
  try {
    const cutoff = addDays(todayParis(), -30);
    const events = parseIcal(await fetchCalendarText(feed.url)).filter((event) => event.end >= cutoff);
    await db.tx(async (q) => {
      // Verrouille le flux : deux synchronisations simultanées ne se marchent pas dessus.
      const locked = await q.run(sql`SELECT id FROM ical_feeds WHERE id = ${feed.id}::uuid FOR UPDATE`);
      if (locked.length === 0) return;
      await q.run(sql`DELETE FROM external_events WHERE feed_id = ${feed.id}::uuid`);
      if (events.length > 0) {
        await q.run(sql`
          INSERT INTO external_events (feed_id, apartment_slug, uid, start_day, end_day, summary)
          SELECT ${feed.id}::uuid, ${feed.apartmentSlug}, x.uid, x.start::date, x."end"::date, x.summary
          FROM jsonb_to_recordset(${JSON.stringify(events)}::jsonb)
            AS x(uid text, start text, "end" text, summary text)
          ON CONFLICT (feed_id, uid) DO NOTHING
        `);
      }
      await q.run(sql`
        UPDATE ical_feeds SET last_synced_at = now(), last_ok_at = now(), last_error = NULL WHERE id = ${feed.id}::uuid
      `);
    });
    return { feedId: feed.id, ok: true, events: events.length, error: null };
  } catch (error) {
    const message =
      error instanceof FeedError
        ? error.message
        : error instanceof Error && error.name === "TimeoutError"
          ? "La plateforme n'a pas répondu à temps."
          : error instanceof Error && error.message.includes("iCal")
            ? error.message
            : "Synchronisation impossible.";
    if (!(error instanceof FeedError)) {
      console.error(`[ical] flux ${feed.id} :`, error instanceof Error ? error.message : error);
    }
    await db
      .run(sql`UPDATE ical_feeds SET last_synced_at = now(), last_error = ${message} WHERE id = ${feed.id}::uuid`)
      .catch(() => {});
    return { feedId: feed.id, ok: false, events: 0, error: message };
  }
}

/**
 * Synchronise les flux qui n'ont pas été rafraîchis depuis `maxAgeMinutes`.
 * Avec `apartmentSlug`, se limite à cet appartement.
 */
export async function syncStaleFeeds(maxAgeMinutes: number, apartmentSlug?: string): Promise<SyncResult[]> {
  const db = await getDb();
  const rows = await db.run<FeedRow>(sql`
    SELECT * FROM ical_feeds
    WHERE (${apartmentSlug ?? null}::text IS NULL OR apartment_slug = ${apartmentSlug ?? null}::text)
      AND (last_synced_at IS NULL OR last_synced_at < now() - make_interval(mins => ${maxAgeMinutes}::int))
  `);
  return Promise.all(rows.map((row) => syncFeed(mapFeed(row))));
}

/** Calendrier .ics d'un appartement à partir de son jeton secret, ou null si le jeton est inconnu. */
export async function exportCalendar(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await getDb();
  const settings = await db.run<{ slug: string }>(sql`SELECT slug FROM apartment_settings WHERE ical_token = ${token}`);
  if (settings.length === 0) return null;
  const slug = settings[0].slug;
  const rows = await db.run<{ id: string; check_in: string; check_out: string }>(sql`
    SELECT id, check_in, check_out FROM reservations
    WHERE apartment_slug = ${slug} AND status = 'confirmed' AND check_out >= ${addDays(todayParis(), -1)}::date
    ORDER BY check_in
  `);
  // Aucune donnée personnelle n'est exportée : seulement des périodes « Réservé ».
  const events: IcalEvent[] = rows.map((row) => ({
    uid: `${row.id}@petit-sport-chalet`,
    start: row.check_in,
    end: row.check_out,
    summary: "Réservé",
  }));
  return buildIcal(getApartmentBySlug(slug)?.name ?? slug, events);
}

export async function regenerateExportToken(apartmentSlug: string): Promise<void> {
  const db = await getDb();
  await db.run(sql`
    UPDATE apartment_settings
    SET ical_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), updated_at = now()
    WHERE slug = ${apartmentSlug}
  `);
}
