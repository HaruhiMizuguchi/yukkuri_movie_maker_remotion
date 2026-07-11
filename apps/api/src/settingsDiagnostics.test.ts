import { describe, expect, it, vi } from "vitest";
import { buildSettingsDiagnostics } from "./settingsDiagnostics";

describe("settings diagnostics", () => {
  it("秘密値を返さず環境変数とAivis接続状態だけを返す", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const diagnostics = await buildSettingsDiagnostics({
      env: {
        GOOGLE_API_KEY: "real-google-key",
        AIVIS_SPEECH_BASE_URL: "http://127.0.0.1:10101",
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(diagnostics).toEqual({
      googleApiKey: { configured: true },
      aivisSpeech: { configured: true, reachable: true, status: 200 },
    });
    expect(JSON.stringify(diagnostics)).not.toContain("real-google-key");
    expect(fetchFn).toHaveBeenCalledWith("http://127.0.0.1:10101/speakers", expect.any(Object));
  });
});
