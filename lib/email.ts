// Envoi des emails via l'API Resend, sans dépendance supplémentaire.

import { site } from "@/config/site";
import { getApartmentBySlug } from "@/lib/apartments";
import type { Reservation } from "@/lib/bookings";
import { diffDays, formatDay, formatEuros } from "@/lib/dates";
import { getBaseUrl } from "@/lib/seo";

interface Email {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** Échappe le texte saisi par un visiteur avant de l'insérer dans du HTML. */
function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Retire les retours à la ligne : un objet d'email ne doit jamais pouvoir injecter d'en-tête. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

async function send(email: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    const level = process.env.NODE_ENV === "production" ? "error" : "info";
    console[level](
      `[email] non envoyé (RESEND_API_KEY ou EMAIL_FROM manquant) → ${email.to.join(", ")} : ${email.subject}`
    );
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: oneLine(email.subject),
        html: email.html,
        text: email.text,
        reply_to: email.replyTo,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`[email] refusé par Resend (${response.status}) : ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] échec d'envoi :", error instanceof Error ? error.message : error);
    return false;
  }
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#F9F7F2;font-family:Helvetica,Arial,sans-serif;color:#4A3C32;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #4A3C32;border-radius:4px;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:#8B7D6B;">${esc(site.name)}</p>
        <h1 style="margin:0;font-size:20px;line-height:1.3;">${esc(title)}</h1>
      </td></tr>
      <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function rows(pairs: Array<[string, string]>): string {
  const cells = pairs
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#8B7D6B;vertical-align:top;white-space:nowrap;">${esc(label)}</td><td style="padding:6px 0;">${esc(value)}</td></tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:15px;">${cells}</table>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0 8px;"><a href="${esc(href)}" style="display:inline-block;background:#4A3C32;color:#F9F7F2;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600;">${esc(label)}</a></p>`;
}

function stayFacts(reservation: Reservation): Array<[string, string]> {
  const apartment = getApartmentBySlug(reservation.apartmentSlug);
  const nights = diffDays(reservation.checkIn, reservation.checkOut);
  const facts: Array<[string, string]> = [
    ["Appartement", apartment?.name ?? reservation.apartmentSlug],
    ["Arrivée", `${formatDay(reservation.checkIn)} à partir de ${site.checkInTime}`],
    ["Départ", `${formatDay(reservation.checkOut)} avant ${site.checkOutTime}`],
    ["Durée", `${nights} nuit${nights > 1 ? "s" : ""}`],
  ];
  if (reservation.guests) facts.push(["Voyageurs", String(reservation.guests)]);
  if (reservation.totalPriceCents !== null) facts.push(["Prix total", formatEuros(reservation.totalPriceCents)]);
  return facts;
}

function toText(title: string, intro: string, facts: Array<[string, string]>, outro = ""): string {
  return [title, "", intro, "", ...facts.map(([k, v]) => `${k} : ${v}`), "", outro].join("\n").trim();
}

function contactLine(): string {
  return `${site.contactEmail} · ${site.phones.map((p) => p.label).join(" · ")}`;
}

/** Prévient l'équipe qu'une demande attend dans le tableau de bord. */
export async function sendAdminNewRequest(reservation: Reservation): Promise<boolean> {
  const recipients = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (recipients.length === 0) {
    console.error("[email] ADMIN_NOTIFICATION_EMAILS n'est pas configuré : l'équipe n'est pas prévenue.");
    return false;
  }
  const facts: Array<[string, string]> = [
    ...stayFacts(reservation),
    ["Client", reservation.guestName ?? ""],
    ["Email", reservation.guestEmail ?? ""],
    ["Téléphone", reservation.guestPhone ?? ""],
    ["Adresse", reservation.guestAddress ?? ""],
  ];
  const title = "Nouvelle demande de réservation";
  const intro = "Une demande vient d'arriver. Les dates restent libres sur le site tant que vous ne l'avez pas acceptée.";
  const dashboardUrl = `${getBaseUrl()}/admin`;
  return send({
    to: recipients,
    subject: `Nouvelle demande : ${reservation.guestName ?? "client"} · ${formatDay(reservation.checkIn, { day: "numeric", month: "short" })} → ${formatDay(reservation.checkOut, { day: "numeric", month: "short" })}`,
    html: layout(title, `<p>${esc(intro)}</p>${rows(facts)}${button(dashboardUrl, "Ouvrir le tableau de bord")}`),
    text: toText(title, intro, facts, `Tableau de bord : ${dashboardUrl}`),
    replyTo: reservation.guestEmail ?? undefined,
  });
}

/** Accusé de réception envoyé au client : sa demande n'est pas encore confirmée. */
export async function sendClientRequestReceived(reservation: Reservation): Promise<boolean> {
  if (!reservation.guestEmail) return false;
  const title = "Nous avons bien reçu votre demande";
  const intro = `Bonjour ${reservation.guestName ?? ""}, merci pour votre demande. Elle n'est pas encore confirmée : nous vérifions la disponibilité et revenons vers vous très vite.`;
  const outro = `Une question ? ${contactLine()}`;
  const facts = stayFacts(reservation);
  return send({
    to: [reservation.guestEmail],
    subject: `Votre demande de réservation – ${site.name}`,
    html: layout(title, `<p>${esc(intro)}</p>${rows(facts)}<p style="color:#8B7D6B;font-size:14px;">${esc(outro)}</p>`),
    text: toText(title, intro, facts, outro),
    replyTo: site.contactEmail,
  });
}

export async function sendClientConfirmed(reservation: Reservation): Promise<boolean> {
  if (!reservation.guestEmail) return false;
  const title = "Votre réservation est confirmée";
  const intro = `Bonjour ${reservation.guestName ?? ""}, bonne nouvelle : votre séjour est confirmé. Nous vous recontactons pour les modalités pratiques.`;
  const outro = `À très bientôt à Serre Chevalier. ${contactLine()}`;
  const facts = stayFacts(reservation);
  return send({
    to: [reservation.guestEmail],
    subject: `Réservation confirmée – ${site.name}`,
    html: layout(title, `<p>${esc(intro)}</p>${rows(facts)}<p style="color:#8B7D6B;font-size:14px;">${esc(outro)}</p>`),
    text: toText(title, intro, facts, outro),
    replyTo: site.contactEmail,
  });
}

export async function sendClientRefused(reservation: Reservation): Promise<boolean> {
  if (!reservation.guestEmail) return false;
  const title = "Votre demande de réservation";
  const intro = `Bonjour ${reservation.guestName ?? ""}, nous sommes désolés : nous ne pouvons pas donner suite à votre demande pour ces dates.`;
  const outro = `D'autres dates sont peut-être disponibles sur ${getBaseUrl()} — ou contactez-nous : ${contactLine()}`;
  const facts = stayFacts(reservation).slice(0, 3);
  return send({
    to: [reservation.guestEmail],
    subject: `Votre demande de réservation – ${site.name}`,
    html: layout(title, `<p>${esc(intro)}</p>${rows(facts)}<p style="color:#8B7D6B;font-size:14px;">${esc(outro)}</p>`),
    text: toText(title, intro, facts, outro),
    replyTo: site.contactEmail,
  });
}
