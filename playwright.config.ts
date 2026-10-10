import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3188", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3188",
    // Enable the UI only in this isolated test server; never allow live writes.
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key", WORKER_AVAILABILITY_RENEWAL_ENABLED: "true", MARKETPLACE_ENABLED: "true", EXPRESS_ENABLED: "false", SUPABASE_SERVICE_ROLE_KEY: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", WHATSAPP_ACCESS_TOKEN: "", LEGACY_WORKER_EDIT_ENABLED: "false", LEGACY_CHECKOUT_ENABLED: "false" },
    url: "http://127.0.0.1:3188/solicitar",
    reuseExistingServer: false,
    timeout: 180000,
  },
});
