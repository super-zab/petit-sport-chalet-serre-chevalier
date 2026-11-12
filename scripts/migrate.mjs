// Met à jour le schéma de la base Postgres désignée par DATABASE_URL.
// Lancé automatiquement avant chaque build Vercel (script "vercel-build").

import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runMigrations } from "../db/migrate-core.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL n'est pas défini : impossible de migrer la base.");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  // Verrou consultatif : deux builds simultanés ne migrent pas en même temps.
  await client.query("SELECT pg_advisory_lock(7216431)");
  const applied = await runMigrations(
    {
      query: async (text) => (await client.query(text)).rows,
      exec: (text) => client.query(text),
    },
    dir
  );
  console.log(applied.length ? `Migrations appliquées : ${applied.join(", ")}` : "Base déjà à jour.");
} catch (error) {
  console.error("Échec de la migration :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
