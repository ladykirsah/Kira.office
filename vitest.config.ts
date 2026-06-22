import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      include: ["packages/**/src/**/*.ts"],
      exclude: ["packages/**/src/**/*.test.ts", "packages/**/src/index.ts"],
    },
  },
});
