import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{packages,apps}/**/src/**/*.test.ts", "scripts/**/*.test.mjs"],
    environment: "node",
    coverage: {
      include: ["{packages,apps}/**/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
