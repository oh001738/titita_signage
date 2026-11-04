import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3002",
    viewport: { width: 1600, height: 900 },
    headless: true,
  },
  reporter: "list",
});
