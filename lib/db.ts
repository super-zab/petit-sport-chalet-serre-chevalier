// Accès à la base de données.
// Production : Postgres (Neon) via DATABASE_URL.
// Développement sans DATABASE_URL : base Postgres embarquée (PGlite), stockée dans node_modules/.cache/.

import path from "node:path";

export interface SqlQuery {
  text: string;
  params: unknown[];
}

/**
 * Construit une requête paramétrée : chaque valeur interpolée devient un paramètre ($1, $2…),
 * jamais du texte SQL. C'est ce qui protège de l'injection SQL.
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return { text, params: values };
}

export interface Queryable {
  run<T = Record<string, unknown>>(query: SqlQuery): Promise<T[]>;
}

export interface Db extends Queryable {
  /** Exécute fn dans une transaction : tout est validé, ou rien. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

const DATE_OID = 1082;

/** Vrai si la connexion à la base a été coupée (base serverless mise en veille, réseau…). */
function isConnectionError(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  return (
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT" ||
    code === "57P01" || // connexion fermée par le serveur
    /Connection terminated|connection timeout/i.test(message ?? "")
  );
}

async function createPostgres(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  // Les colonnes "date" restent des chaînes AAAA-MM-JJ : aucun décalage de fuseau possible.
  pg.types.setTypeParser(DATE_OID, (value: string) => value);
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX) || 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (error) => console.error("[db] erreur de connexion inactive :", error.message));

  /** Ouvre une transaction ; une connexion morte est remplacée une fois avant d'abandonner. */
  async function begin() {
    for (let attempt = 0; ; attempt++) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        return client;
      } catch (error) {
        client.release(true);
        if (attempt > 0 || !isConnectionError(error)) throw error;
      }
    }
  }

  return {
    async run<T>(query: SqlQuery) {
      try {
        return (await pool.query(query.text, query.params)).rows as T[];
      } catch (error) {
        // Une requête isolée est rejouée une fois si la connexion a été coupée. Les écritures
        // faites hors transaction sont sans danger à rejouer : au pire une tentative comptée
        // deux fois par la limitation de débit, ou une ligne en double dans le journal.
        if (!isConnectionError(error)) throw error;
        return (await pool.query(query.text, query.params)).rows as T[];
      }
    },
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      const client = await begin();
      let broken = false;
      try {
        const result = await fn({
          async run<R>(query: SqlQuery) {
            return (await client.query(query.text, query.params)).rows as R[];
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        broken = isConnectionError(error);
        if (!broken) await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release(broken);
      }
    },
  };
}

async function createEmbedded(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const { runMigrations } = await import("../db/migrate-core.mjs");

  // Rangée sous node_modules/.cache : ignorée par git et par le rechargement à chaud de Next
  // (dans le dossier du projet, chaque écriture de la base relançait une compilation).
  const dataDir =
    process.env.PGLITE_DIR ?? path.join(process.cwd(), "node_modules", ".cache", "petit-sport-chalet", "pglite");
  if (dataDir !== "memory") {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(dataDir), { recursive: true });
  }
  const db = new PGlite({
    ...(dataDir === "memory" ? {} : { dataDir }),
    extensions: { btree_gist },
    parsers: { [DATE_OID]: (value: string) => value },
  });
  await db.waitReady;
  await runMigrations(
    {
      query: async (text: string) => (await db.query<Record<string, unknown>>(text)).rows,
      exec: (text: string) => db.exec(text),
    },
    path.join(process.cwd(), "db", "migrations")
  );

  return {
    async run<T>(query: SqlQuery) {
      return (await db.query<T>(query.text, query.params)).rows;
    },
    tx<T>(fn: (q: Queryable) => Promise<T>) {
      return db.transaction((tx) =>
        fn({
          async run<R>(query: SqlQuery) {
            return (await tx.query<R>(query.text, query.params)).rows;
          },
        })
      ) as Promise<T>;
    },
  };
}

const globalStore = globalThis as { __pscDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalStore.__pscDb) {
    // DATABASE_URL en priorité ; POSTGRES_URL est le nom créé par certaines intégrations Vercel.
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    let created: Promise<Db>;
    if (url) {
      created = createPostgres(url);
    } else if (process.env.NODE_ENV !== "production") {
      created = createEmbedded();
    } else {
      created = Promise.reject(new Error("DATABASE_URL n'est pas configuré."));
    }
    // En cas d'échec, on retentera à la prochaine requête au lieu de garder l'erreur en mémoire.
    created.catch(() => {
      if (globalStore.__pscDb === created) globalStore.__pscDb = undefined;
    });
    globalStore.__pscDb = created;
  }
  return globalStore.__pscDb;
}

/** Vrai si l'erreur vient de la contrainte anti-chevauchement des réservations confirmées. */
export function isOverlapError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23P01";
}

/** Vrai si l'erreur est une violation de contrainte d'unicité. */
export function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
