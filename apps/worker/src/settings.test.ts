import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  readWorkerApiKeys,
  readWorkerGoogleApiKey,
  readWorkerSettings,
} from "./settings";

const createWorkspace = async () => {
  const workspaceRoot = path.join(
    process.cwd(),
    "outputs",
    "test_evidence",
    "worker_settings",
    `workspace-${Date.now()}`,
  );
  await fs.mkdir(path.join(workspaceRoot, "outputs", "system"), {
    recursive: true,
  });
  return workspaceRoot;
};

describe("worker settings", () => {
  it("API側が保存した出力プリセットをWorkerで読み込める", async () => {
    const workspaceRoot = await createWorkspace();
    await fs.writeFile(
      path.join(workspaceRoot, "outputs", "system", "settings.json"),
      JSON.stringify({
        models: {
          script: "gemini-3.1-flash-lite",
          image: "gemini-3.1-flash-image",
        },
        outputPreset: { width: 1280, height: 720, fps: 24 },
      }),
      "utf-8",
    );

    await expect(readWorkerSettings(workspaceRoot)).resolves.toEqual({
      models: {
        script: "gemini-3.1-flash-lite",
        image: "gemini-3.1-flash-image",
      },
      outputPreset: { width: 1280, height: 720, fps: 24 },
    });
  });

  it("ジョブ作成時の設定snapshotをグローバル設定より優先する", async () => {
    const workspaceRoot = await createWorkspace();
    await expect(
      readWorkerSettings(workspaceRoot, {
        models: {
          script: "gemini-3.5-flash",
          image: "gemini-3.1-flash-lite-image",
        },
        outputPreset: { width: 854, height: 480, fps: 30 },
      }),
    ).resolves.toEqual({
      models: {
        script: "gemini-3.5-flash",
        image: "gemini-3.1-flash-lite-image",
      },
      outputPreset: { width: 854, height: 480, fps: 30 },
    });
  });

  it("秘密ストアのAPIキーを通常設定とは別に読み込む", async () => {
    const workspaceRoot = await createWorkspace();
    await fs.writeFile(
      path.join(workspaceRoot, "outputs", "system", "secrets.json"),
      JSON.stringify({ googleApiKey: "worker-stored-key" }),
      "utf-8",
    );

    await expect(readWorkerGoogleApiKey(workspaceRoot, {})).resolves.toBe(
      "worker-stored-key",
    );
  });

  it("3社の保存キーと環境変数を同じ優先順位で読み込む", async () => {
    const workspaceRoot = await createWorkspace();
    await fs.writeFile(
      path.join(workspaceRoot, "outputs", "system", "secrets.json"),
      JSON.stringify({
        googleApiKey: "stored-google-key",
        openaiApiKey: "stored-openai-key",
      }),
      "utf-8",
    );

    await expect(
      readWorkerApiKeys(workspaceRoot, {
        GOOGLE_API_KEY: "env-google-key",
        OPENAI_API_KEY: "env-openai-key",
        ANTHROPIC_API_KEY: "env-anthropic-key",
      }),
    ).resolves.toEqual({
      google: "stored-google-key",
      openai: "stored-openai-key",
      anthropic: "env-anthropic-key",
    });
  });
});
