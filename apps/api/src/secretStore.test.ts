import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearGoogleApiKey,
  getGoogleApiKeyStatus,
  resolveGoogleApiKey,
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
});
