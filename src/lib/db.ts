import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

function envUrl(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

const databaseUrl = envUrl("DATABASE_URL", "NETLIFY_DATABASE_URL");
const globalState = globalThis as unknown as {
  __remPool?: pg.Pool;
  __remLocal?: Promise<PGlite>;
};

export function usingPostgres() {
  return databaseUrl !== "";
}

function statements(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !part.split("\n").every((line) => line.trim().startsWith("--") || line.trim() === ""),
    );
}

type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

async function localDb() {
  globalState.__remLocal ??= startLocal().catch((error: unknown) => {
    globalState.__remLocal = undefined;
    throw error;
  });
  return globalState.__remLocal;
}

function pool() {
  globalState.__remPool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
  return globalState.__remPool;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    return (await pool().query(text, params)).rows as T[];
  }
  return (await (await localDb()).query<T>(text, params)).rows;
}

export async function transaction<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
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
  const dir = process.env.PGLITE_DIR?.trim() || ".data/pglite";
  if (dir !== ":memory:") await mkdir(dirname(dir), { recursive: true });
  const db = dir === ":memory:" ? new PGlite() : new PGlite(dir);
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = (await readdir("migrations").catch(() => []))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map((row) => row.name),
  );
  for (const file of files) {
    if (done.has(file)) continue;
    const script = await readFile(`migrations/${file}`, "utf8");
    await db.exec("begin");
    try {
      for (const statement of statements(script)) {
        await db.exec(statement);
      }
      await db.query("insert into schema_migrations (name) values ($1)", [file]);
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  }
  return db;
}
