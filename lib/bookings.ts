// Cœur du système de réservation : disponibilités, prix, demandes, validations, blocages.
// Convention partout : check_out est exclusif (séjour du 11 au 13 = nuits du 11 et du 12).

import { getDb, isOverlapError, sql, type Queryable } from "@/lib/db";
import { addDays, diffDays, isDay, todayParis, type Day } from "@/lib/dates";
import { getApartmentBySlug } from "@/lib/apartments";

/** Jusqu'à quand on peut réserver (≈ 18 mois). */
export const BOOKING_HORIZON_DAYS = 550;
export const MAX_NIGHTS = 60;

export type ReservationStatus = "pending" | "confirmed" | "refused" | "cancelled";
export type ReservationKind = "guest" | "block";

export interface Reservation {
  id: string;
  apartmentSlug: string;
  kind: ReservationKind;
  status: ReservationStatus;
  source: "site" | "admin";
  checkIn: Day;
  checkOut: Day;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestAddress: string | null;
  guests: number | null;
  totalPriceCents: number | null;
  notes: string | null;
  createdAt: string;
}

export interface PendingRequest extends Reservation {
  /** Texte explicatif si les dates sont déjà prises, sinon null. */
  conflict: string | null;
}

export interface ExternalEvent {
  id: string;
  feedId: string;
  feedName: string;
  apartmentSlug: string;
  startDay: Day;
  endDay: Day;
  summary: string | null;
}

export interface ApartmentSettings {
  slug: string;
  defaultPriceCents: number;
  icalToken: string;
}

/** Erreur métier dont le message peut être montré tel quel à l'utilisateur. */
export class BookingError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid" | "unavailable" | "not_found"
  ) {
    super(message);
    this.name = "BookingError";
  }
}

type Row = Record<string, unknown>;

function mapReservation(row: Row): Reservation {
  return {
    id: row.id as string,
    apartmentSlug: row.apartment_slug as string,
    kind: row.kind as ReservationKind,
    status: row.status as ReservationStatus,
    source: row.source as "site" | "admin",
    checkIn: row.check_in as Day,
    checkOut: row.check_out as Day,
    guestName: (row.guest_name as string | null) ?? null,
    guestEmail: (row.guest_email as string | null) ?? null,
    guestPhone: (row.guest_phone as string | null) ?? null,
    guestAddress: (row.guest_address as string | null) ?? null,
    guests: (row.guests as number | null) ?? null,
    totalPriceCents: (row.total_price_cents as number | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}

function mapExternal(row: Row): ExternalEvent {
  return {
    id: row.id as string,
    feedId: row.feed_id as string,
    feedName: row.feed_name as string,
    apartmentSlug: row.apartment_slug as string,
    startDay: row.start_day as Day,
    endDay: row.end_day as Day,
    summary: (row.summary as string | null) ?? null,
  };
}

function assertApartment(slug: string) {
  const apartment = getApartmentBySlug(slug);
  if (!apartment) throw new BookingError("Appartement introuvable.", "not_found");
  return apartment;
}

function assertRange(checkIn: string, checkOut: string) {
  if (!isDay(checkIn) || !isDay(checkOut)) throw new BookingError("Dates invalides.", "invalid");
  if (checkOut <= checkIn) throw new BookingError("La date de départ doit être après la date d'arrivée.", "invalid");
}

// ---------------------------------------------------------------------------
// Réglages et prix
// ---------------------------------------------------------------------------

export async function getAllSettings(): Promise<ApartmentSettings[]> {
  const db = await getDb();
  const rows = await db.run<Row>(sql`SELECT slug, default_price_cents, ical_token FROM apartment_settings ORDER BY slug`);
  return rows.map((row) => ({
    slug: row.slug as string,
    defaultPriceCents: row.default_price_cents as number,
    icalToken: row.ical_token as string,
  }));
}

async function getDefaultPriceCents(q: Queryable, slug: string): Promise<number> {
  const rows = await q.run<Row>(sql`SELECT default_price_cents FROM apartment_settings WHERE slug = ${slug}`);
  if (rows.length === 0) throw new BookingError("Appartement introuvable.", "not_found");
  return rows[0].default_price_cents as number;
}

async function getPriceOverrides(q: Queryable, slug: string, from: Day, toExclusive: Day): Promise<Record<Day, number>> {
  const rows = await q.run<Row>(sql`
    SELECT day, price_cents FROM daily_prices
    WHERE apartment_slug = ${slug} AND day >= ${from}::date AND day < ${toExclusive}::date
  `);
  const prices: Record<Day, number> = {};
  for (const row of rows) prices[row.day as Day] = row.price_cents as number;
  return prices;
}

export interface Quote {
  nights: number;
  totalCents: number;
}

/** Prix d'un séjour, calculé côté serveur à partir des prix du tableau de bord. */
export async function quoteStay(q: Queryable, slug: string, checkIn: Day, checkOut: Day): Promise<Quote> {
  const defaultCents = await getDefaultPriceCents(q, slug);
  const overrides = await getPriceOverrides(q, slug, checkIn, checkOut);
  const nights = diffDays(checkIn, checkOut);
  let totalCents = 0;
  for (let i = 0; i < nights; i++) {
    totalCents += overrides[addDays(checkIn, i)] ?? defaultCents;
  }
  return { nights, totalCents };
}

export async function setDefaultPrice(slug: string, priceCents: number): Promise<void> {
  assertApartment(slug);
  const db = await getDb();
  await db.run(sql`UPDATE apartment_settings SET default_price_cents = ${priceCents}, updated_at = now() WHERE slug = ${slug}`);
}

/** Fixe le prix de chaque nuit de la plage, ou revient au prix par défaut si priceCents vaut null. */
export async function setPrices(slug: string, from: Day, toExclusive: Day, priceCents: number | null): Promise<void> {
  assertApartment(slug);
  assertRange(from, toExclusive);
  if (diffDays(from, toExclusive) > 731) throw new BookingError("Plage trop longue (2 ans maximum).", "invalid");
  const db = await getDb();
  if (priceCents === null) {
    await db.run(sql`
      DELETE FROM daily_prices
      WHERE apartment_slug = ${slug} AND day >= ${from}::date AND day < ${toExclusive}::date
    `);
    return;
  }
  await db.run(sql`
    INSERT INTO daily_prices (apartment_slug, day, price_cents)
    SELECT ${slug}, d::date, ${priceCents}::int
    FROM generate_series(${from}::date, ${toExclusive}::date - 1, interval '1 day') AS d
    ON CONFLICT (apartment_slug, day) DO UPDATE SET price_cents = EXCLUDED.price_cents
  `);
}

// ---------------------------------------------------------------------------
// Disponibilités
// ---------------------------------------------------------------------------

/** Ce qui occupe déjà la plage : réservations confirmées, blocages, calendriers externes. */
async function findConflicts(
  q: Queryable,
  slug: string,
  checkIn: Day,
  checkOut: Day,
  options: { ignoreReservationId?: string; ignoreBlocks?: boolean } = {}
): Promise<string[]> {
  const conflicts: string[] = [];
  const reservations = await q.run<Row>(sql`
    SELECT id, kind FROM reservations
    WHERE apartment_slug = ${slug} AND status = 'confirmed'
      AND check_in < ${checkOut}::date AND check_out > ${checkIn}::date
  `);
  for (const row of reservations) {
    if (row.id === options.ignoreReservationId) continue;
    if (row.kind === "block" && options.ignoreBlocks) continue;
    conflicts.push(row.kind === "block" ? "un blocage" : "une réservation confirmée");
  }
  const external = await q.run<Row>(sql`
    SELECT f.name FROM external_events e JOIN ical_feeds f ON f.id = e.feed_id
    WHERE e.apartment_slug = ${slug} AND e.start_day < ${checkOut}::date AND e.end_day > ${checkIn}::date
  `);
  for (const row of external) conflicts.push(`une réservation ${row.name as string}`);
  return [...new Set(conflicts)];
}

export interface PublicCalendar {
  today: Day;
  /** Dernier jour de départ possible. */
  until: Day;
  defaultPriceCents: number;
  /** Prix des nuits qui diffèrent du prix par défaut. */
  prices: Record<Day, number>;
  /** Périodes occupées [début, fin exclue]. Aucune donnée personnelle. */
  busy: Array<[Day, Day]>;
}

export async function getPublicCalendar(slug: string): Promise<PublicCalendar> {
  assertApartment(slug);
  const db = await getDb();
  const today = todayParis();
  const until = addDays(today, BOOKING_HORIZON_DAYS);
  const defaultPriceCents = await getDefaultPriceCents(db, slug);
  const prices = await getPriceOverrides(db, slug, today, until);
  const rows = await db.run<Row>(sql`
    SELECT check_in AS start_day, check_out AS end_day FROM reservations
    WHERE apartment_slug = ${slug} AND status = 'confirmed' AND check_out > ${today}::date AND check_in < ${until}::date
    UNION ALL
    SELECT start_day, end_day FROM external_events
    WHERE apartment_slug = ${slug} AND end_day > ${today}::date AND start_day < ${until}::date
    ORDER BY start_day
  `);
  return {
    today,
    until,
    defaultPriceCents,
    prices,
    busy: rows.map((row) => [row.start_day as Day, row.end_day as Day]),
  };
}

// ---------------------------------------------------------------------------
// Demandes venant du site public
// ---------------------------------------------------------------------------

export interface BookingRequestInput {
  apartmentSlug: string;
  checkIn: string;
  checkOut: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  guests: number;
}

export interface CreatedRequest {
  reservation: Reservation;
  /** Faux si la même demande existait déjà (double clic, nouvel envoi) : pas de nouvel email. */
  isNew: boolean;
}

/**
 * Enregistre une demande « en attente ». Elle ne bloque pas les dates : elles ne le seront
 * qu'une fois la demande acceptée dans le tableau de bord.
 */
export async function createBookingRequest(input: BookingRequestInput): Promise<CreatedRequest> {
  const apartment = assertApartment(input.apartmentSlug);
  assertRange(input.checkIn, input.checkOut);
  const today = todayParis();
  if (input.checkIn < today) throw new BookingError("La date d'arrivée est déjà passée.", "invalid");
  if (input.checkOut > addDays(today, BOOKING_HORIZON_DAYS)) {
    throw new BookingError("Ces dates sont trop lointaines pour être réservées en ligne.", "invalid");
  }
  if (diffDays(input.checkIn, input.checkOut) > MAX_NIGHTS) {
    throw new BookingError(`Les séjours de plus de ${MAX_NIGHTS} nuits se réservent par téléphone.`, "invalid");
  }
  if (input.guests < 1 || input.guests > apartment.maxGuests) {
    throw new BookingError(`Cet appartement accueille ${apartment.maxGuests} personnes au maximum.`, "invalid");
  }

  const db = await getDb();
  return db.tx(async (q) => {
    const conflicts = await findConflicts(q, apartment.slug, input.checkIn, input.checkOut);
    if (conflicts.length > 0) {
      throw new BookingError("Ces dates ne sont plus disponibles.", "unavailable");
    }
    const email = input.email.trim().toLowerCase();
    const existing = await q.run<Row>(sql`
      SELECT * FROM reservations
      WHERE apartment_slug = ${apartment.slug} AND status = 'pending' AND lower(guest_email) = ${email}
        AND check_in = ${input.checkIn}::date AND check_out = ${input.checkOut}::date
      LIMIT 1
    `);
    if (existing.length > 0) return { reservation: mapReservation(existing[0]), isNew: false };

    const quote = await quoteStay(q, apartment.slug, input.checkIn, input.checkOut);
    const rows = await q.run<Row>(sql`
      INSERT INTO reservations
        (apartment_slug, kind, status, source, check_in, check_out,
         guest_name, guest_email, guest_phone, guest_address, guests, total_price_cents)
      VALUES
        (${apartment.slug}, 'guest', 'pending', 'site', ${input.checkIn}::date, ${input.checkOut}::date,
         ${input.name.trim()}, ${email}, ${input.phone.trim()}, ${input.address.trim()}, ${input.guests}::int, ${quote.totalCents}::int)
      RETURNING *
    `);
    return { reservation: mapReservation(rows[0]), isNew: true };
  });
}

// ---------------------------------------------------------------------------
// Tableau de bord : lecture
// ---------------------------------------------------------------------------

export interface AdminMonth {
  defaultPriceCents: number;
  prices: Record<Day, number>;
  reservations: Reservation[];
  external: ExternalEvent[];
}

export async function getAdminMonth(slug: string, from: Day, toExclusive: Day): Promise<AdminMonth> {
  assertApartment(slug);
  const db = await getDb();
  const defaultPriceCents = await getDefaultPriceCents(db, slug);
  const prices = await getPriceOverrides(db, slug, from, toExclusive);
  const reservations = await db.run<Row>(sql`
    SELECT * FROM reservations
    WHERE apartment_slug = ${slug} AND status IN ('pending', 'confirmed')
      AND check_in < ${toExclusive}::date AND check_out > ${from}::date
    ORDER BY check_in, created_at
  `);
  const external = await db.run<Row>(sql`
    SELECT e.*, f.name AS feed_name FROM external_events e JOIN ical_feeds f ON f.id = e.feed_id
    WHERE e.apartment_slug = ${slug} AND e.start_day < ${toExclusive}::date AND e.end_day > ${from}::date
    ORDER BY e.start_day
  `);
  return {
    defaultPriceCents,
    prices,
    reservations: reservations.map(mapReservation),
    external: external.map(mapExternal),
  };
}

export async function listPendingRequests(): Promise<PendingRequest[]> {
  const db = await getDb();
  const rows = await db.run<Row>(sql`
    SELECT r.*,
      (SELECT count(*)::int FROM reservations c
        WHERE c.apartment_slug = r.apartment_slug AND c.status = 'confirmed'
          AND c.check_in < r.check_out AND c.check_out > r.check_in) AS confirmed_conflicts,
      (SELECT string_agg(DISTINCT f.name, ', ') FROM external_events e JOIN ical_feeds f ON f.id = e.feed_id
        WHERE e.apartment_slug = r.apartment_slug
          AND e.start_day < r.check_out AND e.end_day > r.check_in) AS external_conflicts
    FROM reservations r
    WHERE r.status = 'pending'
    ORDER BY r.created_at
  `);
  return rows.map((row) => {
    let conflict: string | null = null;
    if ((row.confirmed_conflicts as number) > 0) conflict = "Ces dates ont été prises entre-temps.";
    else if (row.external_conflicts) conflict = `Dates déjà réservées sur ${row.external_conflicts as string}.`;
    return { ...mapReservation(row), conflict };
  });
}

/** Prochains séjours confirmés, tous appartements confondus. */
export async function listUpcomingStays(limit: number): Promise<Reservation[]> {
  const db = await getDb();
  const rows = await db.run<Row>(sql`
    SELECT * FROM reservations
    WHERE status = 'confirmed' AND kind = 'guest' AND check_out >= ${todayParis()}::date
    ORDER BY check_in
    LIMIT ${limit}::int
  `);
  return rows.map(mapReservation);
}

export async function getReservation(id: string): Promise<Reservation | null> {
  const db = await getDb();
  const rows = await db.run<Row>(sql`SELECT * FROM reservations WHERE id = ${id}::uuid`);
  return rows.length > 0 ? mapReservation(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Tableau de bord : actions
// ---------------------------------------------------------------------------

function describeConflicts(conflicts: string[]): string {
  return `Ces dates sont déjà occupées par ${conflicts.join(" et ")}.`;
}

async function lockReservation(q: Queryable, id: string): Promise<Reservation> {
  const rows = await q.run<Row>(sql`SELECT * FROM reservations WHERE id = ${id}::uuid FOR UPDATE`);
  if (rows.length === 0) throw new BookingError("Réservation introuvable.", "not_found");
  return mapReservation(rows[0]);
}

/** Accepte une demande : les dates deviennent indisponibles sur le site. */
export async function acceptRequest(id: string): Promise<Reservation> {
  const db = await getDb();
  try {
    return await db.tx(async (q) => {
      const reservation = await lockReservation(q, id);
      if (reservation.status !== "pending") {
        throw new BookingError("Cette demande a déjà été traitée.", "invalid");
      }
      const conflicts = await findConflicts(q, reservation.apartmentSlug, reservation.checkIn, reservation.checkOut);
      if (conflicts.length > 0) throw new BookingError(describeConflicts(conflicts), "unavailable");
      const rows = await q.run<Row>(sql`
        UPDATE reservations SET status = 'confirmed', decided_at = now(), updated_at = now()
        WHERE id = ${id}::uuid RETURNING *
      `);
      return mapReservation(rows[0]);
    });
  } catch (error) {
    if (isOverlapError(error)) {
      throw new BookingError("Ces dates viennent d'être prises par une autre réservation.", "unavailable");
    }
    throw error;
  }
}

export async function refuseRequest(id: string): Promise<Reservation> {
  const db = await getDb();
  return db.tx(async (q) => {
    const reservation = await lockReservation(q, id);
    if (reservation.status !== "pending") {
      throw new BookingError("Cette demande a déjà été traitée.", "invalid");
    }
    const rows = await q.run<Row>(sql`
      UPDATE reservations SET status = 'refused', decided_at = now(), updated_at = now()
      WHERE id = ${id}::uuid RETURNING *
    `);
    return mapReservation(rows[0]);
  });
}

/** Annule un séjour confirmé (les dates redeviennent libres) ou supprime un blocage. */
export async function cancelReservation(id: string): Promise<Reservation> {
  const db = await getDb();
  return db.tx(async (q) => {
    const reservation = await lockReservation(q, id);
    if (reservation.status !== "confirmed") {
      throw new BookingError("Seule une réservation confirmée peut être annulée.", "invalid");
    }
    if (reservation.kind === "block") {
      await q.run(sql`DELETE FROM reservations WHERE id = ${id}::uuid`);
      return reservation;
    }
    const rows = await q.run<Row>(sql`
      UPDATE reservations SET status = 'cancelled', decided_at = now(), updated_at = now()
      WHERE id = ${id}::uuid RETURNING *
    `);
    return mapReservation(rows[0]);
  });
}

export interface ManualReservationInput {
  apartmentSlug: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestAddress: string | null;
  guests: number | null;
  /** null = calculer à partir des prix du calendrier. */
  totalPriceCents: number | null;
  notes: string | null;
}

/** Réservation saisie par l'équipe (téléphone, email…) : confirmée immédiatement. */
export async function createManualReservation(input: ManualReservationInput): Promise<Reservation> {
  const apartment = assertApartment(input.apartmentSlug);
  assertRange(input.checkIn, input.checkOut);
  const db = await getDb();
  try {
    return await db.tx(async (q) => {
      const conflicts = await findConflicts(q, apartment.slug, input.checkIn, input.checkOut);
      if (conflicts.length > 0) throw new BookingError(describeConflicts(conflicts), "unavailable");
      const total =
        input.totalPriceCents ?? (await quoteStay(q, apartment.slug, input.checkIn, input.checkOut)).totalCents;
      const rows = await q.run<Row>(sql`
        INSERT INTO reservations
          (apartment_slug, kind, status, source, check_in, check_out, guest_name, guest_email,
           guest_phone, guest_address, guests, total_price_cents, notes, decided_at)
        VALUES
          (${apartment.slug}, 'guest', 'confirmed', 'admin', ${input.checkIn}::date, ${input.checkOut}::date,
           ${input.guestName}, ${input.guestEmail}, ${input.guestPhone}, ${input.guestAddress},
           ${input.guests}::int, ${total}::int, ${input.notes}, now())
        RETURNING *
      `);
      return mapReservation(rows[0]);
    });
  } catch (error) {
    if (isOverlapError(error)) throw new BookingError("Ces dates sont déjà occupées.", "unavailable");
    throw error;
  }
}

export interface ReservationUpdate {
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestAddress: string | null;
  guests: number | null;
  totalPriceCents: number | null;
  notes: string | null;
}

export async function updateReservation(id: string, update: ReservationUpdate): Promise<Reservation> {
  assertRange(update.checkIn, update.checkOut);
  const db = await getDb();
  try {
    return await db.tx(async (q) => {
      const reservation = await lockReservation(q, id);
      if (reservation.kind !== "guest" || (reservation.status !== "pending" && reservation.status !== "confirmed")) {
        throw new BookingError("Cette réservation ne peut plus être modifiée.", "invalid");
      }
      const datesChanged = reservation.checkIn !== update.checkIn || reservation.checkOut !== update.checkOut;
      if (datesChanged && reservation.status === "confirmed") {
        const conflicts = await findConflicts(q, reservation.apartmentSlug, update.checkIn, update.checkOut, {
          ignoreReservationId: id,
        });
        if (conflicts.length > 0) throw new BookingError(describeConflicts(conflicts), "unavailable");
      }
      const rows = await q.run<Row>(sql`
        UPDATE reservations SET
          check_in = ${update.checkIn}::date, check_out = ${update.checkOut}::date,
          guest_name = ${update.guestName}, guest_email = ${update.guestEmail}, guest_phone = ${update.guestPhone},
          guest_address = ${update.guestAddress}, guests = ${update.guests}::int,
          total_price_cents = ${update.totalPriceCents}::int, notes = ${update.notes}, updated_at = now()
        WHERE id = ${id}::uuid RETURNING *
      `);
      return mapReservation(rows[0]);
    });
  } catch (error) {
    if (isOverlapError(error)) throw new BookingError("Ces dates sont déjà occupées.", "unavailable");
    throw error;
  }
}

/** Retire les blocages de la plage, en conservant ce qui dépasse avant et après. */
async function clearBlocks(q: Queryable, slug: string, from: Day, toExclusive: Day): Promise<number> {
  const blocks = await q.run<Row>(sql`
    SELECT * FROM reservations
    WHERE apartment_slug = ${slug} AND kind = 'block' AND status = 'confirmed'
      AND check_in < ${toExclusive}::date AND check_out > ${from}::date
    FOR UPDATE
  `);
  for (const row of blocks) {
    const block = mapReservation(row);
    await q.run(sql`DELETE FROM reservations WHERE id = ${block.id}::uuid`);
    const remnants: Array<[Day, Day]> = [];
    if (block.checkIn < from) remnants.push([block.checkIn, from]);
    if (block.checkOut > toExclusive) remnants.push([toExclusive, block.checkOut]);
    for (const [start, end] of remnants) {
      await q.run(sql`
        INSERT INTO reservations (apartment_slug, kind, status, source, check_in, check_out, notes, decided_at)
        VALUES (${slug}, 'block', 'confirmed', 'admin', ${start}::date, ${end}::date, ${block.notes}, now())
      `);
    }
  }
  return blocks.length;
}

/** Rend les nuits de la plage indisponibles sur le site (travaux, usage personnel…). */
export async function blockRange(slug: string, from: Day, toExclusive: Day, note: string | null): Promise<void> {
  assertApartment(slug);
  assertRange(from, toExclusive);
  const db = await getDb();
  try {
    await db.tx(async (q) => {
      const conflicts = await findConflicts(q, slug, from, toExclusive, { ignoreBlocks: true });
      if (conflicts.length > 0) {
        throw new BookingError(
          `Impossible de bloquer : la période contient ${conflicts.join(" et ")}.`,
          "unavailable"
        );
      }
      await clearBlocks(q, slug, from, toExclusive);
      await q.run(sql`
        INSERT INTO reservations (apartment_slug, kind, status, source, check_in, check_out, notes, decided_at)
        VALUES (${slug}, 'block', 'confirmed', 'admin', ${from}::date, ${toExclusive}::date, ${note}, now())
      `);
    });
  } catch (error) {
    if (isOverlapError(error)) throw new BookingError("Ces dates sont déjà occupées.", "unavailable");
    throw error;
  }
}

/** Rouvre à la réservation les nuits bloquées de la plage. Renvoie le nombre de blocages modifiés. */
export async function unblockRange(slug: string, from: Day, toExclusive: Day): Promise<number> {
  assertApartment(slug);
  assertRange(from, toExclusive);
  const db = await getDb();
  return db.tx((q) => clearBlocks(q, slug, from, toExclusive));
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export async function audit(userEmail: string | null, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    const db = await getDb();
    await db.run(sql`
      INSERT INTO audit_log (user_email, action, detail) VALUES (${userEmail}, ${action}, ${JSON.stringify(detail)}::jsonb)
    `);
  } catch (error) {
    console.error("[audit] écriture impossible :", error instanceof Error ? error.message : error);
  }
}
