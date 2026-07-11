import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("generateBestAvailableVideo dry run", () => {
  it("Remotion中心の1〜2分動画生成計画を返す", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [path.join("scripts", "generateBestAvailableVideo.mjs"), "--dry-run"],
      { cwd: process.cwd() },
    );
    const plan = JSON.parse(stdout) as {
      lineCount: number;
      renderer: string;
      targetDurationSec: { min: number; max: number };
      steps: string[];
      richFeatures: string[];
    };
    expect(plan.lineCount).toBeGreaterThanOrEqual(14);
    expect(plan.renderer).toBe("remotion");
    expect(plan.targetDurationSec).toEqual({ min: 60, max: 120 });
    expect(plan.steps).toEqual([
      "script_generation",
      "tts_generation",
      "subtitle_generation",
      "video_composition",
      "final_encoding",
      "verification",
    ]);
    expect(plan.richFeatures).toContain("remotion_rendering");
  });
});
