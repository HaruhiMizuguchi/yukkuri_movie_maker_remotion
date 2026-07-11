import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/**/*.test.ts",
      "packages/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/outputs/**",
      "**/projects/**",
      "**/*.real.test.ts",
      "**/*Real.test.ts",
      "**/realApiConnectivity.test.ts",
      "**/task3TtsRealApi.test.ts",
      "**/task3FullRunReal.test.ts",
    ],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
