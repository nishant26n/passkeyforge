import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test/coverage output, not source.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    // Playwright fixtures call a callback literally named `use(...)` to
    // hand back a fixture value — react-hooks' name-based heuristic
    // mistakes that for a React hook call. There's no React here at all.
    files: ["tests/e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
