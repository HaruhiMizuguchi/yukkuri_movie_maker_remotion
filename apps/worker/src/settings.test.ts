import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readWorkerSettings } from "./settings";

const createWorkspace = async () => {
  const workspaceRoot = path.join(
    process.cwd(),
    "outputs",
    "test_evidence",
    "worker_settings",
    `workspace-${Date.now()}`
  );
  await fs.mkdir(path.join(workspaceRoot, "outputs", "system"), { recursive: true });
  return workspaceRoot;
};

describe("worker settings", () => {
  it("API側が保存した出力プリセットをWorkerで読み込める", async () => {
    const workspaceRoot = await createWorkspace();
    await fs.writeFile(
      path.join(workspaceRoot, "outputs", "system", "settings.json"),
      JSON.stringify({
        apiKeys: { google: "secret" },
        outputPreset: { width: 1280, height: 720, fps: 24 },
      }),
      "utf-8"
    );

    await expect(readWorkerSettings(workspaceRoot)).resolves.toEqual({
      outputPreset: { width: 1280, height: 720, fps: 24 },
    });
  });
});
