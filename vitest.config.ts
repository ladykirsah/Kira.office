import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{packages,apps}/**/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      include: ["{packages,apps}/**/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
