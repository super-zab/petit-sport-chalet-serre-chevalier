"use server";

// Actions accessibles sans être connecté : connexion et création du premier compte.
// Chacune est limitée en nombre de tentatives.

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  MIN_PASSWORD_LENGTH,
  countAdmins,
  createAdmin,
  createSession,
  destroySession,
  findAdminByEmail,
  safeEqual,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/auth";
import { audit } from "@/lib/bookings";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export interface FormState {
  error?: string;
}

const emailSchema = z.string().trim().toLowerCase().max(200).pipe(z.email());

function minutes(seconds: number): string {
  const value = Math.ceil(seconds / 60);
  return `${value} minute${value > 1 ? "s" : ""}`;
}

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  if (!email.success || typeof password !== "string" || password.length === 0 || password.length > 500) {
    return { error: "Email ou mot de passe incorrect." };
  }

  const ip = await clientIp();
  const byIp = await rateLimit(`login-ip:${ip}`, 10, 900);
  const byEmail = await rateLimit(`login-email:${email.data}`, 5, 900);
  if (!byIp.ok || !byEmail.ok) {
    const wait = Math.max(byIp.ok ? 0 : byIp.retryAfter, byEmail.ok ? 0 : byEmail.retryAfter);
    return { error: `Trop de tentatives. Réessayez dans ${minutes(wait)}.` };
  }

  const user = await findAdminByEmail(email.data);
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyAgainstDummy(password);
  if (!user || !valid) {
    await audit(null, "connexion_refusee", { email: email.data, ip });
    return { error: "Email ou mot de passe incorrect." };
  }

  await createSession(user.id);
  await audit(user.email, "connexion", { ip });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/connexion");
}

/** Création du tout premier compte, protégée par le jeton ADMIN_SETUP_TOKEN. */
export async function setupAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  const limit = await rateLimit(`setup:${ip}`, 5, 900);
  if (!limit.ok) return { error: `Trop de tentatives. Réessayez dans ${minutes(limit.retryAfter)}.` };

  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected || expected.length < 16) {
    return { error: "L'installation est désactivée : ADMIN_SETUP_TOKEN n'est pas configuré sur le serveur." };
  }
  if ((await countAdmins()) > 0) {
    return { error: "Un compte existe déjà. Connectez-vous, puis ajoutez d'autres comptes depuis les réglages." };
  }

  const token = formData.get("token");
  const email = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  if (typeof token !== "string" || !safeEqual(token.trim(), expected)) {
    await audit(null, "installation_refusee", { ip });
    return { error: "Jeton d'installation incorrect." };
  }
  if (!email.success) return { error: "Adresse email invalide." };
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 500) {
    return { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }

  const admin = await createAdmin(email.data, password);
  await createSession(admin.id);
  await audit(admin.email, "installation", { ip });
  redirect("/admin");
}
