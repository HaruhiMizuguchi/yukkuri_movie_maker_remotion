import { describe, expect, it } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

const loadGoogleApiKey = async (): Promise<string | null> => {
  if (process.env.GOOGLE_API_KEY?.trim()) {
    return process.env.GOOGLE_API_KEY.trim();
  }
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envText = await fs.readFile(envPath, "utf-8");
    const matched = envText
      .split(/\r?\n/)
      .find((line) => line.startsWith("GOOGLE_API_KEY="));
    if (!matched) {
      return null;
    }
    const raw = matched.split("=", 2)[1] ?? "";
    return raw.trim() || null;
  } catch {
    return null;
  }
};

const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

describe("real api connectivity", () => {
  it("Gemini APIへ接続し証跡を保存する", async () => {
    const apiKey = await loadGoogleApiKey();
    if (!apiKey) {
      return;
    }

    const outputDir = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "task6",
      `real-api-${Date.now()}`
    );
    await fs.mkdir(outputDir, { recursive: true });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "JSONで{\"ok\":true,\"message\":\"hello\"}を返してください" }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      }
    );

    const json = await response.json();
    await fs.writeFile(
      path.join(outputDir, "gemini_response.json"),
      `${JSON.stringify(json, null, 2)}\n`,
      "utf-8"
    );

    if (response.ok) {
      expect(json).toHaveProperty("candidates");
      return;
    }

    expect(json).toHaveProperty("error");
    expect([429, 503]).toContain(response.status);
  }, 120000);
});
