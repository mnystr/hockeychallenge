#!/usr/bin/env node
// Copies prod Supabase state to dev, then applies any pending migrations
// on dev to rehearse what will happen when those migrations run on prod.
//
// SAFETY
//   - Requires --i-mean-it flag.
//   - Aborts if PROD_PROJECT_REF and DEV_PROJECT_REF are the same.
//   - Only writes to dev. Prod is read-only.
//
// REQUIREMENTS
//   - pg_dump and psql on PATH (PostgreSQL 17+ client tools).
//     Windows: install via https://www.postgresql.org/download/windows/
//     macOS:   brew install libpq && brew link --force libpq
//     Linux:   apt-get install postgresql-client-17
//   - npx supabase (already used by the project)
//   - .env.rehearse populated — copy from .env.rehearse.example
//
// USAGE
//   node --env-file=.env.rehearse scripts/rehearse-prod-deploy.mjs --i-mean-it

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const FLAG = "--i-mean-it";
if (!process.argv.includes(FLAG)) {
  console.error(
    `\n  This script wipes the dev Supabase project and replaces it with a copy of prod.\n` +
      `  Prod is not modified, but the dev wipe is irreversible.\n\n` +
      `  Run with the explicit flag if you mean it:\n` +
      `    node --env-file=.env.rehearse scripts/rehearse-prod-deploy.mjs ${FLAG}\n`,
  );
  process.exit(1);
}

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(
      `Missing env var: ${name}. Copy .env.rehearse.example to .env.rehearse and fill it in.`,
    );
    process.exit(1);
  }
  return v;
};

const PROD_REF = need("PROD_PROJECT_REF");
const PROD_PWD = need("PROD_DB_PASSWORD");
const PROD_SR = need("PROD_SERVICE_ROLE_KEY");
const DEV_REF = need("DEV_PROJECT_REF");
const DEV_PWD = need("DEV_DB_PASSWORD");
const DEV_SR = need("DEV_SERVICE_ROLE_KEY");

if (PROD_REF === DEV_REF) {
  console.error(
    "ABORT: PROD_PROJECT_REF and DEV_PROJECT_REF are identical. That would wipe prod.",
  );
  process.exit(1);
}

const prodDbUrl = `postgresql://postgres:${encodeURIComponent(PROD_PWD)}@db.${PROD_REF}.supabase.co:5432/postgres`;
const devDbUrl = `postgresql://postgres:${encodeURIComponent(DEV_PWD)}@db.${DEV_REF}.supabase.co:5432/postgres`;
const prodApiUrl = `https://${PROD_REF}.supabase.co`;
const devApiUrl = `https://${DEV_REF}.supabase.co`;

const tmp = resolve(".tmp/rehearse");
mkdirSync(tmp, { recursive: true });

const run = (cmd, args, opts = {}) => {
  const display = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
  console.log(`▸ ${cmd} ${display}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`Command failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
};

console.log(`\nRehearsing prod deploy:\n  PROD ref: ${PROD_REF}\n  DEV  ref: ${DEV_REF}\n`);

// ---------------------------------------------------------------------------
// 1. Wipe dev's public + supabase_migrations schemas; clear auth + storage.
// ---------------------------------------------------------------------------
console.log("[1/6] Wiping dev...");
const wipeSql = `
  drop schema if exists public cascade;
  create schema public;
  grant usage on schema public to anon, authenticated, service_role;
  grant create on schema public to postgres;
  drop schema if exists supabase_migrations cascade;
  delete from auth.users;
  delete from storage.objects;
  delete from storage.buckets;
`;
run("psql", [devDbUrl, "-v", "ON_ERROR_STOP=1", "-c", wipeSql]);

// ---------------------------------------------------------------------------
// 2. Dump prod's public + migration tracking schemas (full: schema + data).
// ---------------------------------------------------------------------------
console.log("[2/6] Dumping prod public + migration tracking...");
const publicDump = resolve(tmp, "prod-public.sql");
run("pg_dump", [
  prodDbUrl,
  "--schema=public",
  "--schema=supabase_migrations",
  "--no-owner",
  "--no-acl",
  "--no-tablespaces",
  "-f",
  publicDump,
]);

// ---------------------------------------------------------------------------
// 3. Dump prod's auth + storage tables (data only — schemas are managed
//    by Supabase itself and already exist on the dev project).
// ---------------------------------------------------------------------------
console.log("[3/6] Dumping prod auth + storage data...");
const authDump = resolve(tmp, "prod-auth.sql");
run("pg_dump", [
  prodDbUrl,
  "--data-only",
  "--table=auth.users",
  "--table=auth.identities",
  "--no-owner",
  "--no-acl",
  "-f",
  authDump,
]);
const storageDump = resolve(tmp, "prod-storage.sql");
run("pg_dump", [
  prodDbUrl,
  "--data-only",
  "--table=storage.buckets",
  "--table=storage.objects",
  "--no-owner",
  "--no-acl",
  "-f",
  storageDump,
]);

// ---------------------------------------------------------------------------
// 4. Restore dumps into dev.
// ---------------------------------------------------------------------------
console.log("[4/6] Restoring dumps to dev...");
run("psql", [devDbUrl, "-v", "ON_ERROR_STOP=1", "-f", publicDump]);
run("psql", [devDbUrl, "-v", "ON_ERROR_STOP=1", "-f", authDump]);
run("psql", [devDbUrl, "-v", "ON_ERROR_STOP=1", "-f", storageDump]);

// ---------------------------------------------------------------------------
// 5. Sync storage file bytes from prod to dev.
//    pg_dump only copied the storage.objects rows (metadata). The actual
//    bytes live behind Supabase storage; we stream them via the JS client.
// ---------------------------------------------------------------------------
console.log("[5/6] Syncing storage files...");
const prod = createClient(prodApiUrl, PROD_SR, { auth: { persistSession: false } });
const dev = createClient(devApiUrl, DEV_SR, { auth: { persistSession: false } });

const { data: buckets, error: bErr } = await prod.storage.listBuckets();
if (bErr) {
  console.error("listBuckets failed:", bErr);
  process.exit(1);
}

let totalFiles = 0;
let totalBytes = 0;
for (const bucket of buckets ?? []) {
  const objects = await listAllObjects(prod, bucket.name);
  console.log(`  bucket ${bucket.name}: ${objects.length} files`);
  for (const obj of objects) {
    const { data: blob, error: dErr } = await prod.storage
      .from(bucket.name)
      .download(obj.path);
    if (dErr) {
      console.error(`  download failed for ${obj.path}:`, dErr.message);
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: uErr } = await dev.storage
      .from(bucket.name)
      .upload(obj.path, buf, {
        upsert: true,
        contentType: obj.metadata?.mimetype ?? "application/octet-stream",
      });
    if (uErr) {
      console.error(`  upload failed for ${obj.path}:`, uErr.message);
      continue;
    }
    totalFiles += 1;
    totalBytes += buf.length;
  }
}
console.log(`  synced ${totalFiles} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);

// ---------------------------------------------------------------------------
// 6. Apply pending migrations to dev. Because we restored prod's
//    supabase_migrations.schema_migrations table, this only runs the
//    migrations that haven't yet hit prod — the same set that will run
//    when the dev branch merges to main.
// ---------------------------------------------------------------------------
console.log("[6/6] Applying pending migrations to dev...");
const supaEnv = { ...process.env, SUPABASE_DB_PASSWORD: DEV_PWD };
run("npx", ["--yes", "supabase", "link", "--project-ref", DEV_REF], { env: supaEnv });
run("npx", ["--yes", "supabase", "db", "push"], { env: supaEnv });

console.log(`\n✓ Rehearsal complete.`);
console.log(`  Open the dev URL and exercise the app — that's running with prod data and pending migrations applied.`);
console.log(`  If it looks healthy, merge dev → main and the same migrations will hit prod via CI.`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function listAllObjects(client, bucket, prefix = "") {
  const all = [];
  const stack = [prefix];
  while (stack.length) {
    const dir = stack.pop();
    let offset = 0;
    while (true) {
      const { data, error } = await client.storage.from(bucket).list(dir, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        if (item.id === null) {
          stack.push(dir ? `${dir}/${item.name}` : item.name);
        } else {
          all.push({
            path: dir ? `${dir}/${item.name}` : item.name,
            metadata: item.metadata,
          });
        }
      }
      if (data.length < 100) break;
      offset += 100;
    }
  }
  return all;
}
