// Authentification du tableau de bord : mot de passe haché (scrypt) et session en cookie HttpOnly.

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, sql } from "@/lib/db";

export const MIN_PASSWORD_LENGTH = 12;
const SESSION_DAYS = 30;
const IS_PROD = process.env.NODE_ENV === "production";
// Le préfixe __Host- impose HTTPS, Path=/ et interdit qu'un sous-domaine écrase le cookie.
const COOKIE_NAME = IS_PROD ? "__Host-psc_admin" : "psc_admin";

// Paramètres scrypt recommandés par l'OWASP (N=2^15, r=8, p=3).
const SCRYPT = { N: 32768, r: 8, p: 3, keylen: 64 };

function scryptAsync(password: string, salt: Buffer, params: typeof SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      params.keylen,
      { N: params.N, r: params.r, p: params.p, maxmem: 256 * params.N * params.r },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keylen: expected.length,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Haché factice : quand l'email est inconnu on vérifie quand même un mot de passe,
// pour que le temps de réponse ne révèle pas quels comptes existent.
let dummyHash: Promise<string> | undefined;
export function verifyAgainstDummy(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(18).toString("base64"));
  return dummyHash.then((hash) => verifyPassword(password, hash));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparaison en temps constant de deux secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export interface AdminUser {
  id: string;
  email: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.run(sql`
    INSERT INTO admin_sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}::uuid, now() + make_interval(days => ${SESSION_DAYS}::int))
  `);
  await db.run(sql`UPDATE admin_users SET last_login_at = now() WHERE id = ${userId}::uuid`);
  await db.run(sql`DELETE FROM admin_sessions WHERE expires_at < now()`);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    const db = await getDb();
    await db.run(sql`DELETE FROM admin_sessions WHERE token_hash = ${hashToken(token)}`);
  }
  store.delete(COOKIE_NAME);
}

/** Ferme toutes les sessions d'un compte (après un changement de mot de passe par exemple). */
export async function destroyAllSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.run(sql`DELETE FROM admin_sessions WHERE user_id = ${userId}::uuid`);
}

/** Administrateur connecté, ou null. Mis en cache le temps d'une requête. */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.run<{ id: string; email: string }>(sql`
    SELECT u.id, u.email FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()
  `);
  return rows[0] ?? null;
});

/**
 * À appeler en tête de chaque page et de chaque action du tableau de bord :
 * la vérification ne repose jamais sur le seul proxy.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/connexion");
  return admin;
}

export async function countAdmins(): Promise<number> {
  const db = await getDb();
  const rows = await db.run<{ n: number }>(sql`SELECT count(*)::int AS n FROM admin_users`);
  return rows[0].n;
}

export async function findAdminByEmail(email: string): Promise<{ id: string; email: string; passwordHash: string } | null> {
  const db = await getDb();
  const rows = await db.run<{ id: string; email: string; password_hash: string }>(sql`
    SELECT id, email, password_hash FROM admin_users WHERE email = ${email.trim().toLowerCase()}
  `);
  return rows[0] ? { id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash } : null;
}

export async function createAdmin(email: string, password: string): Promise<AdminUser> {
  const db = await getDb();
  const rows = await db.run<{ id: string; email: string }>(sql`
    INSERT INTO admin_users (email, password_hash)
    VALUES (${email.trim().toLowerCase()}, ${await hashPassword(password)})
    RETURNING id, email
  `);
  return rows[0];
}

export async function setPassword(userId: string, password: string): Promise<void> {
  const db = await getDb();
  await db.run(sql`UPDATE admin_users SET password_hash = ${await hashPassword(password)} WHERE id = ${userId}::uuid`);
}

export async function listAdmins(): Promise<Array<{ id: string; email: string; lastLoginAt: string | null }>> {
  const db = await getDb();
  const rows = await db.run<{ id: string; email: string; last_login_at: Date | null }>(sql`
    SELECT id, email, last_login_at FROM admin_users ORDER BY created_at
  `);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  }));
}

export async function deleteAdmin(userId: string): Promise<void> {
  const db = await getDb();
  await db.run(sql`DELETE FROM admin_users WHERE id = ${userId}::uuid`);
}
