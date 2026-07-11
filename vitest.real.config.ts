import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "**/*.real.test.ts",
      "**/*Real.test.ts",
      "**/realApiConnectivity.test.ts",
      "**/task3TtsRealApi.test.ts",
      "**/task3FullRunReal.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/outputs/**",
      "**/projects/**",
    ],
    testTimeout: 300_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
