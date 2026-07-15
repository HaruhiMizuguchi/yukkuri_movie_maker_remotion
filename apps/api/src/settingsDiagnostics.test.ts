import { describe, expect, it, vi } from "vitest";
import { buildSettingsDiagnostics } from "./settingsDiagnostics";

describe("settings diagnostics", () => {
  it("秘密値を返さず3社AIとAivisの実接続状態を返す", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const diagnostics = await buildSettingsDiagnostics({
      env: {
        AIVIS_SPEECH_BASE_URL: "http://127.0.0.1:10101",
      },
      apiKeys: {
        google: "real-google-key",
        openai: "real-openai-key",
        anthropic: "real-anthropic-key",
      },
      apiKeySources: {
        google: "stored",
        openai: "environment",
        anthropic: "stored",
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(diagnostics).toEqual({
      googleApiKey: {
        configured: true,
        reachable: true,
        source: "stored",
        status: 200,
      },
      openaiApiKey: {
        configured: true,
        reachable: true,
        source: "environment",
        status: 200,
      },
      anthropicApiKey: {
        configured: true,
        reachable: true,
        source: "stored",
        status: 200,
      },
      aivisSpeech: { configured: true, reachable: true, status: 200 },
    });
    expect(JSON.stringify(diagnostics)).not.toContain("real-google-key");
    expect(JSON.stringify(diagnostics)).not.toContain("real-openai-key");
    expect(JSON.stringify(diagnostics)).not.toContain("real-anthropic-key");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models",
      expect.objectContaining({
        headers: { "x-goog-api-key": "real-google-key" },
      }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer real-openai-key" },
      }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        headers: {
          "x-api-key": "real-anthropic-key",
          "anthropic-version": "2023-06-01",
        },
      }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:10101/speakers",
      expect.any(Object),
    );
  });
});
