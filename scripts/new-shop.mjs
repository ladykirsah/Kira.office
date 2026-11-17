#!/usr/bin/env node
/**
 * Make a new shop (plan 10.3, owner 17 Nov 2026: "I create new shops on your word; no sign-up page
 * yet"). Each shop has its own database with the standard lists, its own owner account and its own
 * name on ข้อมูลร้าน; the app's web address picks it (see apps/api/src/shops.ts).
 *
 *   node scripts/new-shop.mjs --practice --id practice2 --name "ร้านทดลอง 2" \
 *     --origin http://localhost:8082 --owner-email owner2@practice.local
 *   node scripts/new-shop.mjs --id coolair --name "ร้านคูลแอร์" \
 *     --origin https://coolair.teampit.formulal.cc --owner-email owner@coolair.example
 *
 * --practice runs every step on the local practice copy (wrangler.practice.jsonc). Without it the
 * steps are only printed: each one touches Cloudflare and runs only after the owner's yes, together
 * with creating the database, adding it to wrangler.jsonc and giving the shop its web address.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { hashPassword, randomPassword } from "../packages/core/src/staffAuth.ts";

// The same rules the server checks (apps/api/src/shops.ts readShops), so a shop made here is one it
// accepts.
const SHOP_ID = /^[a-z0-9][a-z0-9-]{1,30}$/;
const ORIGIN = /^(https:\/\/[a-z0-9.-]+|http:\/\/localhost:\d+)$/;
const EMAIL = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;

/** The shop's line in the SHOPS setting. Refuses a bad input before anything is made. */
export function shopEntry({ id, name, origin, ownerEmail }) {
  const shopId = String(id ?? "").trim();
  if (!SHOP_ID.test(shopId) || shopId === "denair") {
    throw new Error(`shop id must be 2–31 lower-case letters, digits or "-", and not "denair"`);
  }
  if (!ORIGIN.test(String(origin ?? ""))) {
    throw new Error("web address must be https://… (or http://localhost:… on the practice copy)");
  }
  const email = String(ownerEmail ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email)) throw new Error("owner email is not an email");
  const shopName = String(name ?? "").trim();
  if (!shopName) throw new Error("shop name is required");
  return {
    id: shopId,
    name: shopName,
    db: `DB_${shopId.toUpperCase().replace(/-/g, "_")}`,
    origins: [origin],
    ownerEmails: email,
  };
}

/** The shop's own D1 database. */
export const databaseName = (id) => `kira-shop-${id}`;

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

/** The shop's first account: its owner, signing in with a temporary password (then a PIN). */
export async function ownerAccountSql({ email, name, password, now, userId }) {
  const stored = await hashPassword(password);
  const text = [userId, name, email.trim().toLowerCase(), "super_admin", "active"].map(quote);
  return `INSERT INTO users (id, name, email, role, status, created_at, password_hash, password_salt, password_iterations, password_set_at, failed_attempts) VALUES (${text.join(", ")}, ${now}, ${quote(stored.hash)}, ${quote(stored.salt)}, ${stored.iterations}, ${now}, 0);`;
}

/** What the setup runs, in order: the database with the standard lists, the owner, the name. */
export function setupSteps({ id, name, practice, ownerSqlFile = "owner.sql" }) {
  const where = practice ? ["--local", "-c", "wrangler.practice.jsonc"] : ["--remote"];
  const db = databaseName(id);
  return [
    {
      say: "its own database, with the standard lists",
      file: "npx",
      args: ["wrangler", "d1", "migrations", "apply", db, ...where],
    },
    {
      say: "its owner account",
      file: "npx",
      args: ["wrangler", "d1", "execute", db, ...where, "--file", ownerSqlFile],
    },
    {
      say: "its name on ข้อมูลร้าน",
      file: "npx",
      args: [
        "wrangler",
        "kv",
        "key",
        "put",
        "--binding",
        "KV",
        `shops/${id}/shop:denair:name`,
        name,
        ...where,
      ],
    },
  ];
}

async function main() {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      name: { type: "string" },
      origin: { type: "string" },
      "owner-email": { type: "string" },
      practice: { type: "boolean", default: false },
    },
  });
  const entry = shopEntry({ ...values, ownerEmail: values["owner-email"] });
  const password = randomPassword();
  const dir = mkdtempSync(join(tmpdir(), "new-shop-"));
  const ownerSqlFile = join(dir, "owner.sql");
  writeFileSync(
    ownerSqlFile,
    await ownerAccountSql({
      email: entry.ownerEmails,
      name: `เจ้าของ ${entry.name}`,
      password,
      now: Date.now(),
      userId: crypto.randomUUID(),
    }),
  );
  const steps = setupSteps({
    id: entry.id,
    name: entry.name,
    practice: values.practice,
    ownerSqlFile,
  });
  const config = values.practice ? "wrangler.practice.jsonc" : "wrangler.jsonc";
  console.log(`\nShop "${entry.name}" — in ${config}, it needs:`);
  console.log(`  vars.SHOPS entry: ${JSON.stringify(entry)}`);
  console.log(
    `  d1_databases: { "binding": "${entry.db}", "database_name": "${databaseName(entry.id)}", "database_id": "<id>", "migrations_dir": "packages/db/migrations" }`,
  );
  try {
    if (!values.practice) {
      console.log("\nLive: first `npx wrangler d1 create " + databaseName(entry.id) + "`, then:");
      for (const s of steps) console.log(`  · ${s.say}: ${s.file} ${s.args.join(" ")}`);
      console.log("Each touches Cloudflare: run only with the owner's yes.");
      return;
    }
    for (const s of steps) {
      console.log(`\n→ ${s.say}`);
      execFileSync(s.file, s.args, { stdio: "inherit" });
    }
    console.log(`\nDone. Owner signs in with ${entry.ownerEmails} and this password (shown once):`);
    console.log(`  ${password}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
