import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,

    // Playwright specs live in tests/e2e and must only be run by the Playwright
    // runner; picking them up here makes test.describe() throw.
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],

    coverage: {
      provider: "v8",
      // The default "text" table has a display bug on Windows (backslash
      // paths confuse its tree grouping) that silently drops some files'
      // rows even though their numbers are correctly folded into the
      // parent totals. The underlying data is always complete — if a file
      // looks missing from the printed table, check coverage/lcov.info or
      // coverage/coverage-summary.json (or the html report) instead.
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",

      // These unit tests only exercise app/lib — routes, pages, and
      // components are covered by the Playwright e2e suite instead, which
      // this reporter can't see. Measuring against the whole app tree would
      // just report every route/component as 0%, which isn't a real gap.
      include: ["app/lib/**/*.ts"],
      exclude: [
        "app/lib/generated/**",
        "**/*.d.ts",
      ],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "."),
    },
  },
});
