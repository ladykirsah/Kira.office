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
 *   node reset-staff-password.mjs you@example.com            # production
 *   node reset-staff-password.mjs you@example.com --local    # the local dev database
 */
import { spawnSync } from "node:child_process";
import { stdin, stdout } from "node:process";

const email = process.argv[2];
const local = process.argv.includes("--local");
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

// Clearing the lock alongside the password: whoever is running this has already been told their
// password is wrong several times, and leaving a 24-hour lock behind would just move the wall.
const sql = `
UPDATE users
   SET password_hash = '${hash}',
       password_salt = '${salt}',
       password_iterations = ${iterations},
       password_set_at = ${Date.now()},
       failed_attempts = 0,
       locked_until = NULL
 WHERE lower(email) = lower('${email.replace(/'/g, "''")}')
   AND deleted_at IS NULL;
`.trim();

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
