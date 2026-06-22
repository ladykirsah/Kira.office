// Drizzle Kit config for the D1 schema. DRAFT — drizzle-kit is installed in Phase 1.
// Generate SQL migrations with `drizzle-kit generate`, then apply with
// `wrangler d1 migrations apply <DB_NAME>`.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
  // For remote pushes you can use the D1 HTTP driver with account credentials:
  // driver: "d1-http",
  // dbCredentials: { accountId: "...", databaseId: "...", token: "..." },
});
