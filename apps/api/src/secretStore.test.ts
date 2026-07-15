import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearApiKey,
  clearGoogleApiKey,
  getApiKeyStatuses,
  getGoogleApiKeyStatus,
  resolveApiKeys,
  resolveGoogleApiKey,
  saveApiKey,
  saveGoogleApiKey,
} from "./secretStore";

const createWorkspace = async (): Promise<string> => {
  const workspaceRoot = path.join(
    process.cwd(),
    "outputs",
    "test_evidence",
    "secret_store",
    String(Date.now()),
  );
  await fs.mkdir(workspaceRoot, { recursive: true });
  return workspaceRoot;
};

describe("ローカル秘密情報ストア", () => {
  it("APIキーを通常設定と分離し、公開状態には値を含めない", async () => {
    const workspaceRoot = await createWorkspace();
    await saveGoogleApiKey(workspaceRoot, "stored-google-api-key");

    await expect(resolveGoogleApiKey(workspaceRoot, {})).resolves.toBe(
      "stored-google-api-key",
    );
    const status = await getGoogleApiKeyStatus(workspaceRoot, {});
    expect(status).toEqual({ configured: true, source: "stored" });
    expect(JSON.stringify(status)).not.toContain("stored-google-api-key");

    const raw = await fs.readFile(
      path.join(workspaceRoot, "outputs", "system", "secrets.json"),
      "utf-8",
    );
    expect(JSON.parse(raw)).toEqual({
      googleApiKey: "stored-google-api-key",
    });
  });

  it("保存値がなければ環境変数を利用する", async () => {
    const workspaceRoot = await createWorkspace();
    const env = { GOOGLE_API_KEY: "environment-google-api-key" };

    await expect(resolveGoogleApiKey(workspaceRoot, env)).resolves.toBe(
      "environment-google-api-key",
    );
    await expect(getGoogleApiKeyStatus(workspaceRoot, env)).resolves.toEqual({
      configured: true,
      source: "environment",
    });
  });

  it("保存したキーを削除すると未設定状態へ戻る", async () => {
    const workspaceRoot = await createWorkspace();
    await saveGoogleApiKey(workspaceRoot, "stored-google-api-key");
    await clearGoogleApiKey(workspaceRoot);

    await expect(getGoogleApiKeyStatus(workspaceRoot, {})).resolves.toEqual({
      configured: false,
      source: null,
    });
  });

  it("Google・OpenAI・Anthropicのキーを共存させ、公開状態へ値を含めない", async () => {
    const workspaceRoot = await createWorkspace();
    await saveApiKey(workspaceRoot, "google", "stored-google-key");
    await saveApiKey(workspaceRoot, "openai", "stored-openai-key");
    await saveApiKey(workspaceRoot, "anthropic", "stored-anthropic-key");

    await expect(resolveApiKeys(workspaceRoot, {})).resolves.toEqual({
      google: "stored-google-key",
      openai: "stored-openai-key",
      anthropic: "stored-anthropic-key",
    });
    const statuses = await getApiKeyStatuses(workspaceRoot, {});
    expect(statuses).toEqual({
      google: { configured: true, source: "stored" },
      openai: { configured: true, source: "stored" },
      anthropic: { configured: true, source: "stored" },
    });
    expect(JSON.stringify(statuses)).not.toContain("stored-");
  });

  it("1社の保存キーだけを削除して他社のキーを保持する", async () => {
    const workspaceRoot = await createWorkspace();
    await saveApiKey(workspaceRoot, "google", "stored-google-key");
    await saveApiKey(workspaceRoot, "openai", "stored-openai-key");
    await clearApiKey(workspaceRoot, "openai");

    await expect(resolveApiKeys(workspaceRoot, {})).resolves.toEqual({
      google: "stored-google-key",
      openai: undefined,
      anthropic: undefined,
    });
  });

  it("各社の標準環境変数をフォールバックとして利用する", async () => {
    const workspaceRoot = await createWorkspace();
    const env = {
      GOOGLE_API_KEY: "env-google",
      OPENAI_API_KEY: "env-openai",
      ANTHROPIC_API_KEY: "env-anthropic",
    };

    await expect(resolveApiKeys(workspaceRoot, env)).resolves.toEqual({
      google: "env-google",
      openai: "env-openai",
      anthropic: "env-anthropic",
    });
  });
});
