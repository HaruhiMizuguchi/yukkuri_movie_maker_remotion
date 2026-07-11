import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
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

const runCommand = (command: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });

const loadAivisBaseUrl = async (): Promise<string | null> => {
  if (process.env.AIVIS_SPEECH_BASE_URL?.trim()) {
    return process.env.AIVIS_SPEECH_BASE_URL.trim();
  }

  try {
    const envText = await fs.readFile(
      path.join(process.cwd(), ".env"),
      "utf-8",
    );
    const line = envText
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith("AIVIS_SPEECH_BASE_URL="));
    if (!line) {
      return null;
    }
    const value = line.split("=", 2)[1]?.trim();
    return value || null;
  } catch {
    return null;
  }
};

const configuredAivisBaseUrl = await loadAivisBaseUrl();

describe("generateBestAvailableVideo", () => {
  it("本番生成のドライラン計画が Remotion 中心の1〜2分動画縦串になっている", async () => {
    const stdout = await runNode([
      path.join("scripts", "generateBestAvailableVideo.mjs"),
      "--dry-run",
    ]);
    const plan = JSON.parse(stdout) as {
      lineCount: number;
      renderer: string;
      targetDurationSec: { min: number; max: number };
      steps: string[];
      planArtifacts: string[];
      richFeatures: string[];
      requiredAssets: string[];
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
    expect(plan.planArtifacts).toEqual(
      expect.arrayContaining([
        "video_composition/composition.json",
        "video_composition/shot-plan.json",
        "video_composition/visual-plan.json",
        "video_composition/subtitle-presentation.json",
        "video_composition/audio-mix-plan.json",
        "video_composition/chapter-plan.json",
      ]),
    );
    expect(plan.richFeatures).toEqual(
      expect.arrayContaining([
        "remotion_rendering",
        "shot_planning",
        "visual_asset_rotation",
        "subtitle_emphasis",
        "audio_ducking",
        "chapter_transition",
      ]),
    );
    expect(plan.requiredAssets).toEqual(
      expect.arrayContaining([
        ".kamui/movie/media/cyberpunk-city-flight.mp4",
        ".kamui/movie/media/japanese-alley-night.mp4",
        ".kamui/movie/media/neon-dreams.mp3",
      ]),
    );
  });

  it.skipIf(!configuredAivisBaseUrl)(
    "AivisSpeech 実接続で Remotion ショーケース動画を生成できる",
    async () => {
      const outputRoot = path.join(
        process.cwd(),
        "outputs",
        "test_evidence",
        "production_showcase",
        `run-${Date.now()}`,
      );
      const stdout = await runNode([
        path.join("scripts", "generateBestAvailableVideo.mjs"),
        "--profile",
        "smoke",
        "--output-root",
        outputRoot,
      ]);
      const summary = JSON.parse(stdout) as {
        finalPath: string;
        workflowLogPath: string;
        runId: string;
        projectId: string;
      };
      const projectRoot = path.join(
        outputRoot,
        summary.runId,
        "projects",
        summary.projectId,
      );
      const compositionPath = path.join(
        projectRoot,
        "output",
        "video_composition",
        "latest",
        "composition.json",
      );
      const visualPlanPath = path.join(
        projectRoot,
        "output",
        "video_composition",
        "latest",
        "visual-plan.json",
      );
      const composition = JSON.parse(
        await fs.readFile(compositionPath, "utf-8"),
      ) as {
        renderer: string;
        shotCount: number;
        visualTrackCount: number;
        chapterCount: number;
        audioCueCount: number;
      };
      const visualPlan = JSON.parse(
        await fs.readFile(visualPlanPath, "utf-8"),
      ) as {
        tracks: Array<{ assetId: string; sourceType: string }>;
      };
      const videoCodec = await runCommand("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        summary.finalPath,
      ]);
      const workflowLog = await fs.readFile(summary.workflowLogPath, "utf-8");

      expect(composition.renderer).toBe("remotion");
      expect(composition.shotCount).toBeGreaterThanOrEqual(4);
      expect(composition.visualTrackCount).toBeGreaterThanOrEqual(
        composition.shotCount,
      );
      expect(composition.chapterCount).toBeGreaterThan(0);
      expect(composition.audioCueCount).toBeGreaterThan(0);
      expect(
        visualPlan.tracks.some(
          (track) =>
            track.sourceType === "video" || track.sourceType === "image",
        ),
      ).toBe(true);
      expect(videoCodec).toBe("h264");
      expect(workflowLog).toContain('"renderer":"remotion"');
    },
    300000,
  );
});
