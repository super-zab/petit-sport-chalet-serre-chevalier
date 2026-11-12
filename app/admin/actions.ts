"use server";

// Actions du tableau de bord. Chacune commence par vérifier la session (requireAdmin),
// valide ses entrées, puis consigne ce qui a été fait dans le journal.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isApartmentSlug } from "@/lib/apartments";
import {
  MIN_PASSWORD_LENGTH,
  createAdmin,
  createSession,
  deleteAdmin,
  destroyAllSessions,
  findAdminByEmail,
  listAdmins,
  requireAdmin,
  setPassword,
  verifyPassword,
  type AdminUser,
} from "@/lib/auth";
import {
  BookingError,
  acceptRequest,
  audit,
  blockRange,
  cancelReservation,
  createManualReservation,
  getReservation,
  refuseRequest,
  setDefaultPrice,
  setPrices,
  unblockRange,
  updateReservation,
} from "@/lib/bookings";
import { isUniqueError } from "@/lib/db";
import { isDay } from "@/lib/dates";
import { sendClientConfirmed, sendClientRefused } from "@/lib/email";
import { FeedError, addFeed, listFeeds, regenerateExportToken, removeFeed, syncFeed, syncStaleFeeds } from "@/lib/ical";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const slugSchema = z.string().refine(isApartmentSlug, "Appartement inconnu");
const daySchema = z.string().refine(isDay, "Date invalide");
const idSchema = z.uuid();
const eurosSchema = z.number().min(0).max(100_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const rangeSchema = z.object({ slug: slugSchema, from: daySchema, toExclusive: daySchema });

const reservationFields = {
  checkIn: daySchema,
  checkOut: daySchema,
  guestName: z.string().trim().min(1, "Le nom est obligatoire").max(120),
  guestEmail: optionalText(200),
  guestPhone: optionalText(40),
  guestAddress: optionalText(300),
  guests: z.number().int().min(1).max(50).nullable(),
  totalPriceEuros: eurosSchema.nullable(),
  notes: optionalText(2000),
};

const toCents = (euros: number) => Math.round(euros * 100);

/** Exécute une action protégée et transforme les erreurs en message lisible. */
async function run(fn: (admin: AdminUser) => Promise<string>): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const message = await fn(admin);
    revalidatePath("/admin", "layout");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof BookingError || error instanceof FeedError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Saisie invalide." };
    }
    console.error("[admin]", error instanceof Error ? error.message : error);
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}

/** Rafraîchit Airbnb/Booking avant une décision, sans bloquer plus de quelques secondes. */
async function refreshFeeds(slug: string): Promise<void> {
  await Promise.race([
    syncStaleFeeds(5, slug).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 6000)),
  ]);
}

// --- Demandes et réservations ----------------------------------------------

export async function acceptRequestAction(id: string): Promise<ActionResult> {
  return run(async (admin) => {
    const reservationId = idSchema.parse(id);
    const pending = await getReservation(reservationId);
    if (pending) await refreshFeeds(pending.apartmentSlug);
    const reservation = await acceptRequest(reservationId);
    const sent = await sendClientConfirmed(reservation);
    await audit(admin.email, "demande_acceptee", { id: reservationId, emailEnvoye: sent });
    return sent
      ? "Réservation confirmée. Le client a été prévenu par email."
      : "Réservation confirmée, mais l'email au client n'a pas pu être envoyé : prévenez-le directement.";
  });
}

export async function refuseRequestAction(id: string, notify: boolean): Promise<ActionResult> {
  return run(async (admin) => {
    const reservation = await refuseRequest(idSchema.parse(id));
    const sent = notify ? await sendClientRefused(reservation) : false;
    await audit(admin.email, "demande_refusee", { id, emailEnvoye: sent });
    if (!notify) return "Demande refusée, sans email au client.";
    return sent
      ? "Demande refusée. Le client a été prévenu par email."
      : "Demande refusée, mais l'email au client n'a pas pu être envoyé.";
  });
}

export async function cancelReservationAction(id: string): Promise<ActionResult> {
  return run(async (admin) => {
    const reservation = await cancelReservation(idSchema.parse(id));
    await audit(admin.email, reservation.kind === "block" ? "blocage_supprime" : "reservation_annulee", { id });
    return reservation.kind === "block"
      ? "Blocage supprimé : les dates sont de nouveau réservables."
      : "Réservation annulée : les dates sont de nouveau libres. Aucun email n'a été envoyé au client.";
  });
}

export async function createReservationAction(input: unknown): Promise<ActionResult> {
  return run(async (admin) => {
    const data = z.object({ slug: slugSchema, ...reservationFields }).parse(input);
    await refreshFeeds(data.slug);
    const reservation = await createManualReservation({
      apartmentSlug: data.slug,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      guestAddress: data.guestAddress,
      guests: data.guests,
      totalPriceCents: data.totalPriceEuros === null ? null : toCents(data.totalPriceEuros),
      notes: data.notes,
    });
    await audit(admin.email, "reservation_creee", { id: reservation.id });
    return "Réservation enregistrée. Les dates sont maintenant indisponibles sur le site.";
  });
}

export async function updateReservationAction(id: string, input: unknown): Promise<ActionResult> {
  return run(async (admin) => {
    const data = z.object(reservationFields).parse(input);
    await updateReservation(idSchema.parse(id), {
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      guestAddress: data.guestAddress,
      guests: data.guests,
      totalPriceCents: data.totalPriceEuros === null ? null : toCents(data.totalPriceEuros),
      notes: data.notes,
    });
    await audit(admin.email, "reservation_modifiee", { id });
    return "Modifications enregistrées.";
  });
}

// --- Prix et blocages --------------------------------------------------------

export async function setPricesAction(input: unknown): Promise<ActionResult> {
  return run(async (admin) => {
    const data = rangeSchema.extend({ priceEuros: eurosSchema.nullable() }).parse(input);
    await setPrices(data.slug, data.from, data.toExclusive, data.priceEuros === null ? null : toCents(data.priceEuros));
    await audit(admin.email, "prix_modifies", data);
    return data.priceEuros === null ? "Prix par défaut rétabli sur ces dates." : "Prix mis à jour sur le site.";
  });
}

export async function blockRangeAction(input: unknown): Promise<ActionResult> {
  return run(async (admin) => {
    const data = rangeSchema.extend({ note: optionalText(200) }).parse(input);
    await blockRange(data.slug, data.from, data.toExclusive, data.note);
    await audit(admin.email, "dates_bloquees", data);
    return "Dates bloquées : elles ne sont plus réservables sur le site.";
  });
}

export async function unblockRangeAction(input: unknown): Promise<ActionResult> {
  return run(async (admin) => {
    const data = rangeSchema.parse(input);
    const changed = await unblockRange(data.slug, data.from, data.toExclusive);
    await audit(admin.email, "dates_debloquees", data);
    return changed > 0 ? "Dates débloquées : elles sont de nouveau réservables." : "Aucun blocage sur ces dates.";
  });
}

export async function setDefaultPriceAction(slug: string, priceEuros: number): Promise<ActionResult> {
  return run(async (admin) => {
    const data = z.object({ slug: slugSchema, priceEuros: eurosSchema }).parse({ slug, priceEuros });
    await setDefaultPrice(data.slug, toCents(data.priceEuros));
    await audit(admin.email, "prix_defaut_modifie", data);
    return "Prix par défaut mis à jour.";
  });
}

// --- Synchronisation des plateformes ----------------------------------------

export async function addFeedAction(input: unknown): Promise<ActionResult> {
  return run(async (admin) => {
    const data = z
      .object({ slug: slugSchema, name: z.string().trim().min(1).max(40), url: z.string().trim().min(10).max(1000) })
      .parse(input);
    const feed = await addFeed(data.slug, data.name, data.url);
    const result = await syncFeed(feed);
    await audit(admin.email, "calendrier_ajoute", { slug: data.slug, name: data.name });
    return result.ok
      ? `Calendrier ${data.name} ajouté : ${result.events} période(s) importée(s).`
      : `Calendrier ajouté, mais la première synchronisation a échoué : ${result.error}`;
  });
}

export async function removeFeedAction(id: string): Promise<ActionResult> {
  return run(async (admin) => {
    await removeFeed(idSchema.parse(id));
    await audit(admin.email, "calendrier_supprime", { id });
    return "Calendrier supprimé. Ses dates ne bloquent plus le site.";
  });
}

export async function syncFeedsAction(): Promise<ActionResult> {
  return run(async () => {
    const results = await Promise.all((await listFeeds()).map((feed) => syncFeed(feed)));
    if (results.length === 0) return "Aucun calendrier externe à synchroniser.";
    const failed = results.filter((result) => !result.ok).length;
    return failed === 0
      ? `Synchronisation terminée (${results.length} calendrier${results.length > 1 ? "s" : ""}).`
      : `Synchronisation terminée avec ${failed} échec${failed > 1 ? "s" : ""} : voir le détail ci-dessous.`;
  });
}

export async function regenerateTokenAction(slug: string): Promise<ActionResult> {
  return run(async (admin) => {
    await regenerateExportToken(slugSchema.parse(slug));
    await audit(admin.email, "lien_export_regenere", { slug });
    return "Nouveau lien généré. Pensez à le remplacer sur Airbnb et Booking.";
  });
}

// --- Comptes -----------------------------------------------------------------

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  return run(async (admin) => {
    const user = await findAdminByEmail(admin.email);
    if (!user || typeof current !== "string" || !(await verifyPassword(current, user.passwordHash))) {
      throw new BookingError("Le mot de passe actuel est incorrect.", "invalid");
    }
    if (typeof next !== "string" || next.length < MIN_PASSWORD_LENGTH || next.length > 500) {
      throw new BookingError(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`, "invalid");
    }
    await setPassword(admin.id, next);
    // Déconnecte tous les appareils, puis reconnecte celui-ci.
    await destroyAllSessions(admin.id);
    await createSession(admin.id);
    await audit(admin.email, "mot_de_passe_modifie");
    return "Mot de passe modifié. Les autres appareils ont été déconnectés.";
  });
}

export async function addAdminAction(email: string, password: string): Promise<ActionResult> {
  return run(async (admin) => {
    const data = z
      .object({
        email: z.string().trim().toLowerCase().max(200).pipe(z.email("Adresse email invalide")),
        password: z.string().min(MIN_PASSWORD_LENGTH, `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`).max(500),
      })
      .parse({ email, password });
    try {
      await createAdmin(data.email, data.password);
    } catch (error) {
      if (isUniqueError(error)) throw new BookingError("Un compte existe déjà avec cette adresse.", "invalid");
      throw error;
    }
    await audit(admin.email, "compte_cree", { email: data.email });
    return `Compte créé pour ${data.email}. Transmettez-lui le mot de passe par un canal sûr.`;
  });
}

export async function removeAdminAction(id: string): Promise<ActionResult> {
  return run(async (admin) => {
    const userId = idSchema.parse(id);
    if (userId === admin.id) throw new BookingError("Vous ne pouvez pas supprimer votre propre compte.", "invalid");
    const target = (await listAdmins()).find((user) => user.id === userId);
    if (!target) throw new BookingError("Compte introuvable.", "not_found");
    await deleteAdmin(userId);
    await audit(admin.email, "compte_supprime", { email: target.email });
    return `Le compte ${target.email} a été supprimé.`;
  });
}
