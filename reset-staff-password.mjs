#!/usr/bin/env node
/**
 * Recovery: set a staff member's Kira.office password directly in D1.
 *
 * For the case a super admin cannot use the normal "set a new password" screen because they are
 * the one locked out. Two situations reach here:
 *   - a credential hashed at 210,000 rounds, which Cloudflare Workers refuse to compute, so it can
 *     never be verified however correctly it is typed (see PR #128);
 *   - a genuinely forgotten password with no second super admin to reset it.
 *
 * The password is READ FROM A PROMPT, never an argument — so it stays out of shell history, out of
 * `ps`, and out of any chat log. It is hashed with the project's OWN hashPassword, so the stored
 * value cannot drift from what the app expects on the way back in.
 *
 * Usage:
 *   node reset-staff-password.mjs you@example.com              # production, via wrangler
 *   node reset-staff-password.mjs you@example.com --local      # the local dev database
 *   node reset-staff-password.mjs you@example.com --print-sql  # print SQL, run nothing
 *
 * `--print-sql` exists because wrangler needs a login of its own, and the person who most needs this
 * script is the one who is already locked out of something. The printed statement can be pasted into
 * the D1 console in the Cloudflare dashboard, which needs no CLI at all.
 */
import { spawnSync } from "node:child_process";
import { stdin, stdout } from "node:process";

const email = process.argv[2];
const local = process.argv.includes("--local");
const printOnly = process.argv.includes("--print-sql");
if (!email || email.startsWith("--")) {
  console.error("Usage: node reset-staff-password.mjs <email> [--local]");
  process.exit(1);
}

const { hashPassword } = await import("./packages/core/dist/staffAuth.js");

/**
 * Read the two passwords without echoing them.
 *
 * Branches on whether stdin is a real terminal, because the two cases genuinely differ: a person
 * typing needs raw mode to suppress the echo character by character, while piped input (how this
 * script was tested before being pointed at production) has no terminal to put into raw mode and
 * simply arrives as lines. Trying to serve both with one readline left the second prompt hanging.
 */
async function readSecrets() {
  if (!stdin.isTTY) {
    const chunks = [];
    for await (const chunk of stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString().split(/\r?\n/);
  }
  const ask = (question) =>
    new Promise((resolve) => {
      stdout.write(question);
      stdin.setRawMode(true);
      stdin.resume();
      let value = "";
      const onData = (buf) => {
        const char = buf.toString("utf8");
        if (char === "\r" || char === "\n" || char === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stdout.write("\n");
          resolve(value);
        } else if (char === "\u0003") {
          stdout.write("\n");
          process.exit(130); // Ctrl-C leaves everything untouched.
        } else if (char === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      };
      stdin.on("data", onData);
    });
  return [await ask("New password (min 8 chars): "), await ask("Type it again: ")];
}

const [pw, again] = await readSecrets();
if (!pw || pw.length < 8) {
  console.error("Too short — nothing changed.");
  process.exit(1);
}
if (pw !== again) {
  console.error("They don't match — nothing changed.");
  process.exit(1);
}

const { hash, salt, iterations } = await hashPassword(pw);
console.log(`\nHashed at ${iterations} rounds (the platform ceiling is 100000).`);

/**
 * One statement that works whether or not the account exists.
 *
 * `email` is UNIQUE, so an upsert covers both cases — a password that cannot be verified, and an
 * account that was never created in production at all. Both produce exactly the same "Email or
 * password is wrong" on the sign-in screen, and from outside the database there is no way to tell
 * them apart, so the fix should not have to care which one it is.
 *
 * On an existing row it also clears the lock and restores role and status: whoever runs this has
 * been told their password is wrong several times, and leaving a 24-hour lock or a deactivated flag
 * behind would just move the wall.
 */
const now = Date.now();
const safeEmail = email.replace(/'/g, "''");
const sql = `
INSERT INTO users (id, name, email, role, status, created_at, failed_attempts,
                   password_hash, password_salt, password_iterations, password_set_at)
VALUES ('${crypto.randomUUID()}', 'Owner', '${safeEmail}', 'super_admin', 'active', ${now}, 0,
        '${hash}', '${salt}', ${iterations}, ${now})
ON CONFLICT(email) DO UPDATE SET
  password_hash       = excluded.password_hash,
  password_salt       = excluded.password_salt,
  password_iterations = excluded.password_iterations,
  password_set_at     = excluded.password_set_at,
  role                = 'super_admin',
  status              = 'active',
  deleted_at          = NULL,
  failed_attempts     = 0,
  locked_until        = NULL;
`.trim();

if (printOnly) {
  console.log("\n===== 1. OPTIONAL — what state is the account in? =====\n");
  // Worth running first only to learn WHICH problem it was. The fix below handles either.
  console.log(
    `SELECT email, role, status, password_iterations, failed_attempts, locked_until, deleted_at\n` +
      `  FROM users WHERE lower(email) = lower('${safeEmail}');`,
  );
  console.log("\n  no rows           -> the account was never created in production");
  console.log("  iterations 210000 -> exists, but can never be verified on Workers");
  console.log("\n===== 2. THE FIX — paste into Cloudflare dashboard → D1 → kira-office → Console =====\n");
  console.log(sql);
  console.log("\n===== then sign in at admin.airplusauto.com with the password you just typed =====\n");
  process.exit(0);
}

const args = [
  "wrangler",
  "d1",
  "execute",
  "kira-office",
  local ? "--local" : "--remote",
  "--command",
  sql,
];
console.log(`Updating ${local ? "the LOCAL" : "PRODUCTION"} database for ${email}…`);
const run = spawnSync("npx", args, {
  stdio: "inherit",
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: "187ab61ed9dbc6e616cb23e6b95aa8f1" },
});
if (run.status !== 0) {
  console.error("\nThe update did not run. If it says you are not logged in: npx wrangler login");
  process.exit(run.status ?? 1);
}
console.log("\nDone. Sign in with the new password, then set a PIN from /me if you want one.");
