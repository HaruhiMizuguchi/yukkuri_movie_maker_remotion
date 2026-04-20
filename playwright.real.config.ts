import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

process.env.YMM_WORKFLOW_OUTPUT_ROOT ??= path.join(
  process.cwd(),
  "outputs",
  "test_evidence",
  "real_api_e2e",
  "latest"
);
process.env.YMM_TTS_PROVIDER ??= "mock";
process.env.YMM_ALLOW_MOCK_TTS_FALLBACK ??= "true";
process.env.YMM_DISABLE_REMOTION ??= "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /realApiWorkerJourney\.spec\.ts/,
  timeout: 240_000,
  outputDir: "outputs/test_evidence/playwright-real/raw",
  reporter: [
    ["list"],
    ["html", { outputFolder: "outputs/test_evidence/playwright-real/html-report", open: "never" }],
    ["json", { outputFile: "outputs/test_evidence/playwright-real/results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/runRealE2eServers.mjs",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "real-api-worker-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
