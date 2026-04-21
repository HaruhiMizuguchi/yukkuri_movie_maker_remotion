import { spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const runNode = (args: string[]): Promise<string> =>
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
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`node exited with code ${code}: ${stderr}`));
    });
  });

describe("generateBestAvailableVideo", () => {
  it("本番生成のドライラン計画が1〜2分動画の縦串になっている", async () => {
    const stdout = await runNode([
      path.join("scripts", "generateBestAvailableVideo.mjs"),
      "--dry-run",
    ]);
    const plan = JSON.parse(stdout) as {
      lineCount: number;
      targetDurationSec: { min: number; max: number };
      steps: string[];
      requiredAssets: string[];
    };

    expect(plan.lineCount).toBeGreaterThanOrEqual(14);
    expect(plan.targetDurationSec).toEqual({ min: 60, max: 120 });
    expect(plan.steps).toEqual([
      "script_generation",
      "tts_generation",
      "subtitle_generation",
      "video_composition",
      "final_encoding",
      "verification",
    ]);
    expect(plan.requiredAssets).toEqual(
      expect.arrayContaining([
        ".kamui/movie/media/cyberpunk-city-flight.mp4",
        ".kamui/movie/media/japanese-alley-night.mp4",
        ".kamui/movie/media/neon-dreams.mp3",
      ])
    );
  });
});
