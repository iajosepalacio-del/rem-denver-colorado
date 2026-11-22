import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const url =
  process.env.DATABASE_URL?.trim() ||
  process.env.NETLIFY_DB_URL?.trim() ||
  process.env.NETLIFY_DATABASE_URL?.trim() ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  "";
const files = (await readdir("migrations").catch(() => []))
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (url === "" || files.length === 0) {
  console.log("migrate: nothing to do");
  process.exit(0);
}

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED?.trim() ||
    process.env.NETLIFY_DB_URL?.trim() ||
    url,
});
await client.connect();
try {
  const who = await client.query("select current_user as user");
  console.log(`migrate: connected as ${who.rows[0]?.user ?? "unknown"}`);
  await client.query("set lock_timeout = '60s'");
  await client.query("select pg_advisory_lock(7272741)");
  try {
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
  } catch (error) {
    if (error && error.code === "42501") {
      console.log("migrate: skipped (injected role cannot create tables; Netlify applies schema as owner)");
      process.exit(0);
    }
    throw error;
  }
  const done = new Set(
    (await client.query("select name from schema_migrations")).rows.map((row) => row.name),
  );
  for (const file of files.filter((name) => !done.has(name))) {
    await client.query("begin");
    try {
      const sql = await readFile(`migrations/${file}`, "utf8");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`migrate: applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
