import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 1_200_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://101.126.129.76",
    headless: false,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
  },
});
