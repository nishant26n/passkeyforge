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
  },

  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "."),
    },
  },
});
