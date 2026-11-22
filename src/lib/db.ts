import { mkdir, readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const require = createRequire(import.meta.url);

const URL_ENV_NAMES = [
  "DATABASE_URL",
  "NETLIFY_DB_URL",
  "NETLIFY_DATABASE_URL",
  "NETLIFY_DATABASE_URL_UNPOOLED",
  "DATABASE_URL_UNPOOLED",
] as const;

const globalState = globalThis as unknown as {
  __remPool?: pg.Pool;
  __remLocal?: Promise<PGlite>;
  __remPgReady?: Promise<void>;
  __remResolvedUrl?: string;
};

function envUrl() {
  for (const name of URL_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function netlifyInjectedUrl() {
  try {
    // The Next runtime on Netlify often injects NETLIFY_DB_URL through
    // @netlify/runtime-utils rather than the site env envelope.
    const { getConnectionString } = require("@netlify/database") as {
      getConnectionString: () => string;
    };
    return getConnectionString()?.trim() || "";
  } catch {
    return "";
  }
}

function resolveDatabaseUrl() {
  if (globalState.__remResolvedUrl) return globalState.__remResolvedUrl;
  const value = envUrl() || netlifyInjectedUrl();
  if (value) globalState.__remResolvedUrl = value;
  return value;
}

export function usingPostgres() {
  return resolveDatabaseUrl() !== "";
}

export function persistenceMode() {
  return usingPostgres() ? "postgres" : "local";
}

type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

function serverlessDisk() {
  return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
}

function localDataDir() {
  const explicit = process.env.PGLITE_DIR?.trim();
  if (explicit) return explicit;
  if (serverlessDisk()) return "/tmp/rem-pglite";
  return ".data/pglite";
}

async function migrationFiles(includeNetlify = true) {
  const candidates = [
    join(process.cwd(), "migrations"),
    join(process.cwd(), "netlify/database/migrations"),
    join(__dirname, "../../migrations"),
    "/var/task/migrations",
  ];
  for (const dir of candidates) {
    const names = (await readdir(dir).catch(() => []))
      .filter((file) => file.endsWith(".sql") && (includeNetlify || !file.includes("netlify")))
      .sort();
    if (names.length > 0) {
      return names.map((name) => ({ name, path: join(dir, name) }));
    }
  }
  return [];
}

async function applyPostgresMigrations(client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }) {
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    ((await client.query("select name from schema_migrations")).rows as { name: string }[]).map((row) => row.name),
  );
  for (const file of await migrationFiles()) {
    if (done.has(file.name)) continue;
    const script = await readFile(file.path, "utf8");
    await client.query("begin");
    try {
      await client.query(script);
      await client.query("insert into schema_migrations (name) values ($1)", [file.name]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

function isPermissionDenied(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "42501");
}

async function schemaReady(client: { query: (text: string) => Promise<{ rows: unknown[] }> }) {
  const rows = (await client.query(
    "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'events'",
  )).rows;
  return rows.length > 0;
}

async function ensurePostgres() {
  globalState.__remPgReady ??= (async () => {
    const client = await pool().connect();
    try {
      await applyPostgresMigrations(client);
    } catch (error) {
      if (isPermissionDenied(error) && (await schemaReady(client))) {
        return;
      }
      throw error;
    } finally {
      client.release();
    }
  })().catch((error: unknown) => {
    globalState.__remPgReady = undefined;
    throw error;
  });
  return globalState.__remPgReady;
}

async function localDb() {
  globalState.__remLocal ??= startLocal().catch((error: unknown) => {
    globalState.__remLocal = undefined;
    throw error;
  });
  return globalState.__remLocal;
}

function pool() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("No hay URL de Postgres.");
  }
  globalState.__remPool ??= new pg.Pool({
    connectionString: databaseUrl,
    max: 5,
    ssl: databaseUrl.includes("sslmode=") ? undefined : { rejectUnauthorized: true },
  });
  return globalState.__remPool;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (usingPostgres()) {
    await ensurePostgres();
    return (await pool().query(text, params)).rows as T[];
  }
  return (await (await localDb()).query<T>(text, params)).rows;
}

export async function transaction<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  if (usingPostgres()) {
    await ensurePostgres();
    const client = await pool().connect();
    const q: Query = async (text, params = []) => (await client.query(text, params)).rows as never;
    try {
      await client.query("begin");
      const result = await fn(q);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  const db = await localDb();
  const q: Query = async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows;
  await db.exec("begin");
  try {
    const result = await fn(q);
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function startLocal(): Promise<PGlite> {
  const dir = localDataDir();
  if (dir !== ":memory:") await mkdir(dirname(dir), { recursive: true });
  const db = dir === ":memory:" ? new PGlite() : new PGlite(dir);
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map((row) => row.name),
  );
  for (const file of await migrationFiles(false)) {
    if (done.has(file.name)) continue;
    const script = await readFile(file.path, "utf8");
    await db.exec("begin");
    try {
      await db.exec(script);
      await db.query("insert into schema_migrations (name) values ($1)", [file.name]);
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  }
  return db;
}
