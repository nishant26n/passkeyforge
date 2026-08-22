import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// The E2E helpers talk to the same database the app does, so the test process
// needs the same env the dev server loads.
dotenv.config({ path: ".env", quiet: true });

export default defineConfig({
  testDir: "./tests/e2e",

  fullyParallel: false,

  // argon2 hashing plus on-demand dev-server compilation makes the first hit on
  // a route slow; 30s is not enough for the flows that register and sign in.
  timeout: 60_000,

  // The dev server compiles a route the first time it is requested, which can
  // take well over the 5s default on a cold navigation.
  expect: { timeout: 15_000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",

    // `next dev` refuses to start a second server for the same project, so a
    // dev server that is already up has to be reused. If a run reports 500s
    // with "Jest worker encountered N child process exceptions", that server's
    // render worker has died: restart it and re-run.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
