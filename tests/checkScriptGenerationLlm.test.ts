import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const runNode = (
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn("node", args, {
      cwd: process.cwd(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

describe("checkScriptGenerationLlm", () => {
  it("ドライランで Gemini 診断の計画を返す", async () => {
    const result = await runNode([
      path.join("scripts", "checkScriptGenerationLlm.mjs"),
      "--dry-run",
    ]);
    expect(result.code).toBe(0);

    const plan = JSON.parse(result.stdout) as {
      provider: string;
      model: string;
      endpoint: string;
      outputs: string[];
    };

    expect(plan.provider).toBe("gemini");
    expect(plan.model.length).toBeGreaterThan(0);
    expect(plan.endpoint).toContain("generativelanguage.googleapis.com");
    expect(plan.outputs).toEqual(
      expect.arrayContaining([
        "report.json",
        "request.json",
        "raw_response.txt",
      ])
    );
  });

  it("実行時に診断レポートを保存し、APIキーがあれば実接続結果を残す", async () => {
    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "script_generation_llm",
      `run-${Date.now()}`
    );
    const result = await runNode([
      path.join("scripts", "checkScriptGenerationLlm.mjs"),
      "--output-root",
      outputRoot,
    ]);

    const report = JSON.parse(result.stdout) as {
      provider: string;
      apiKeyConfigured: boolean;
      requestAttempted: boolean;
      classification: string;
      responseStatus: number | null;
      outputDir: string;
      reportPath: string;
      rawResponsePath: string;
      generatedScriptPath: string | null;
      success: boolean;
    };

    expect(report.provider).toBe("gemini");
    expect(await fs.stat(report.reportPath)).toBeTruthy();
    expect(await fs.stat(report.rawResponsePath)).toBeTruthy();

    if (!report.apiKeyConfigured) {
      expect(report.classification).toBe("missing_api_key");
      expect(report.requestAttempted).toBe(false);
      return;
    }

    expect(report.requestAttempted).toBe(true);
    expect(report.responseStatus).not.toBeNull();
    expect(
      [
        "ok",
        "quota_exhausted",
        "authentication_error",
        "model_not_found",
        "invalid_request",
        "service_unavailable",
        "schema_mismatch",
        "empty_response",
        "missing_json_block",
        "empty_script",
        "network_error",
        "timeout",
      ].includes(report.classification)
    ).toBe(true);
    if (report.success) {
      expect(report.generatedScriptPath).not.toBeNull();
      expect(await fs.stat(report.generatedScriptPath as string)).toBeTruthy();
      expect(result.code).toBe(0);
      return;
    }

    expect(result.code).toBe(1);
  }, 120000);
});
