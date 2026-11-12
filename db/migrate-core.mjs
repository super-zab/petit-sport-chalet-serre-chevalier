// Applique les fichiers db/migrations/*.sql qui ne l'ont pas encore été.
// Partagé entre le script de build (Postgres/Neon) et la base locale de développement (PGlite).

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * @param {{ query: (text: string) => Promise<Array<Record<string, unknown>>>, exec: (text: string) => Promise<unknown> }} driver
 * @param {string} dir dossier contenant les fichiers .sql
 * @returns {Promise<string[]>} noms des migrations appliquées pendant cet appel
 */
export async function runMigrations(driver, dir) {
  await driver.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );
  const done = new Set((await driver.query("SELECT name FROM schema_migrations")).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    // Le nom de fichier est validé par l'expression régulière ci-dessus : pas d'injection possible.
    await driver.exec(`BEGIN;\n${body}\nINSERT INTO schema_migrations (name) VALUES ('${file}');\nCOMMIT;`);
    applied.push(file);
  }
  return applied;
}
