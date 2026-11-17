import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPassword } from "../packages/core/src/staffAuth.ts";
import { readShops } from "../apps/api/src/shops.ts";
import { databaseName, ownerAccountSql, setupSteps, shopEntry } from "./new-shop.mjs";

// Plan 10.3: making a new shop is one setup I run (owner: no sign-up page yet). It gives the shop
// its own database with the standard lists, its owner account, and its name on ข้อมูลร้าน.

const COOL = {
  id: "coolair",
  name: "ร้านคูลแอร์",
  origin: "https://coolair.teampit.formulal.cc",
  ownerEmail: "Owner@CoolAir.test",
};

describe("shopEntry > the line that adds a shop to the SHOPS setting", () => {
  it("given a new shop > then an entry the server accepts, with its own database binding", () => {
    const entry = shopEntry(COOL);
    expect(entry).toEqual({
      id: "coolair",
      name: "ร้านคูลแอร์",
      db: "DB_COOLAIR",
      origins: ["https://coolair.teampit.formulal.cc"],
      ownerEmails: "owner@coolair.test",
    });
    expect(readShops(JSON.stringify([entry])).map((s) => s.id)).toEqual(["denair", "coolair"]);
  });

  it("given a hyphen in the id > then the binding uses an underscore", () => {
    expect(shopEntry({ ...COOL, id: "cool-air" }).db).toBe("DB_COOL_AIR");
  });

  it("given a bad id, address, email or no name > then it refuses before anything is made", () => {
    expect(() => shopEntry({ ...COOL, id: "denair" })).toThrow(/id/);
    expect(() => shopEntry({ ...COOL, id: "Cool Air" })).toThrow(/id/);
    expect(() => shopEntry({ ...COOL, origin: "http://coolair.test" })).toThrow(/address/);
    expect(() => shopEntry({ ...COOL, ownerEmail: "not-an-email" })).toThrow(/email/);
    expect(() => shopEntry({ ...COOL, name: "  " })).toThrow(/name/);
  });
});

describe("databaseName", () => {
  it("given a shop id > then its own database name", () => {
    expect(databaseName("coolair")).toBe("kira-shop-coolair");
  });
});

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../packages/db/migrations");

describe("ownerAccountSql > the shop's first account, its owner", () => {
  it("given the setup > then an owner who can sign in with the temporary password", async () => {
    const raw = new DatabaseSync(":memory:");
    for (const f of readdirSync(migrationsDir)
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      raw.exec(readFileSync(join(migrationsDir, f), "utf8"));
    }
    const sql = await ownerAccountSql({
      email: "Owner@CoolAir.test",
      name: "เจ้าของ O'Neil",
      password: "Temp-pass-1234",
      now: 1_700_000_000_000,
      userId: "u-owner",
    });
    raw.exec(sql);
    const row = raw
      .prepare(
        "SELECT name, email, role, status, password_hash AS hash, password_salt AS salt, password_iterations AS iterations FROM users WHERE id = 'u-owner'",
      )
      .get();
    expect(row).toMatchObject({
      name: "เจ้าของ O'Neil",
      email: "owner@coolair.test",
      role: "super_admin",
      status: "active",
    });
    expect(await verifyPassword("Temp-pass-1234", row)).toBe(true);
    expect(await verifyPassword("wrong", row)).toBe(false);
  });
});

describe("setupSteps > what the setup runs", () => {
  it("given the practice copy > then the local database, the standard lists, the owner and the name", () => {
    const steps = setupSteps({ id: "practice2", name: "ร้านทดลอง 2", practice: true });
    const cmds = steps.map((s) => s.args.join(" "));
    expect(steps.every((s) => s.file === "npx")).toBe(true);
    expect(cmds[0]).toBe(
      "wrangler d1 migrations apply kira-shop-practice2 --local -c wrangler.practice.jsonc",
    );
    expect(cmds[1]).toMatch(
      /^wrangler d1 execute kira-shop-practice2 --local -c wrangler\.practice\.jsonc --file /,
    );
    expect(cmds[2]).toBe(
      "wrangler kv key put --binding KV shops/practice2/shop:denair:name ร้านทดลอง 2 --local -c wrangler.practice.jsonc",
    );
  });

  it("given a live shop > then the same steps on Cloudflare (each one run only with the owner's yes)", () => {
    const cmds = setupSteps({ id: "coolair", name: "ร้านคูลแอร์", practice: false }).map((s) =>
      s.args.join(" "),
    );
    expect(cmds[0]).toBe("wrangler d1 migrations apply kira-shop-coolair --remote");
    expect(cmds[2]).toBe(
      "wrangler kv key put --binding KV shops/coolair/shop:denair:name ร้านคูลแอร์ --remote",
    );
  });
});
