import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

import {
  createDefaultWorkflowImplementations,
  type WorkflowContext,
} from "./index";

const createPrismaMock = (projectId: string, theme: string) => {
  const prisma: any = {
    workflowStep: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    projectFile: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-remotion-video",
        projectId,
        mode: "full",
        project: { id: projectId, theme },
      }),
    },
  };
  return prisma;
};

const createContext = (projectId: string, theme: string, outputRoot: string): WorkflowContext =>
  ({
    jobId: "job-remotion-video",
    prisma: createPrismaMock(projectId, theme),
    outputRoot,
  }) as WorkflowContext;

const createTempRoot = (suffix: string): string =>
  path.join(process.cwd(), "outputs", "test_evidence", "remotion_video", `${suffix}-${Date.now()}`);

const runCommand = async (command: string, args: string[], cwd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
      reject(new Error(`${command} failed: ${stderr}`));
    });
  });

const writeJson = async (filePath: string, payload: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
};

const prepareMinimalInputs = async (projectRoot: string): Promise<void> => {
  await writeJson(path.join(projectRoot, "output", "script_generation", "latest", "script.json"), {
    title: "Remotion テスト",
    theme: "Remotion 標準経路",
    lines: [
      { speaker: "reimu", text: "最初の字幕です。" },
      { speaker: "marisa", text: "二つ目の字幕です。" },
    ],
  });
  await writeJson(path.join(projectRoot, "output", "subtitle_generation", "latest", "subtitles.json"), [
    { index: 0, speaker: "reimu", text: "最初の字幕です。", startMs: 0, endMs: 1400 },
    { index: 1, speaker: "marisa", text: "二つ目の字幕です。", startMs: 1400, endMs: 2800 },
  ]);
  await fs.mkdir(path.join(projectRoot, "output", "subtitle_generation", "latest"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "output", "subtitle_generation", "latest", "subtitles.ass"),
    "[Script Info]\n[V4+ Styles]\n[Events]\nDialogue: 0,0:00:00.00,0:00:01.40,Default,,0,0,0,,reimu: 最初の字幕です。\nDialogue: 0,0:00:01.40,0:00:02.80,Default,,0,0,0,,marisa: 二つ目の字幕です。\n",
    "utf-8"
  );
  await fs.mkdir(path.join(projectRoot, "output", "tts_generation", "latest"), { recursive: true });
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2.8",
      path.join(projectRoot, "output", "tts_generation", "latest", "audio.wav"),
    ],
    process.cwd()
  );
};

describe("video composition remotion", () => {
  it("video_composition はデフォルトで Remotion を正規経路として使う", async () => {
    const outputRoot = createTempRoot("default-remotion");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "Remotion 標準経路", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId);
    await prepareMinimalInputs(projectRoot);

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "mock",
    });
    await implementations.video_composition?.(ctx);

    const compositionPath = path.join(projectRoot, "output", "video_composition", "latest", "composition.json");
    const previewPath = path.join(projectRoot, "output", "video_composition", "latest", "preview.mp4");
    const shotPlanPath = path.join(projectRoot, "output", "video_composition", "latest", "shot-plan.json");
    const characterPerformancePath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "character-performance.json"
    );
    const subtitlePresentationPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "subtitle-presentation.json"
    );
    const audioMixPlanPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "audio-mix-plan.json"
    );
    const chapterPlanPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "chapter-plan.json"
    );
    const composition = JSON.parse(await fs.readFile(compositionPath, "utf-8")) as {
      renderer: string;
      shotCount: number;
      characterCueCount: number;
      emphasisCount: number;
      audioCueCount: number;
      chapterCount: number;
    };
    const shotPlan = JSON.parse(await fs.readFile(shotPlanPath, "utf-8")) as Array<{
      startMs: number;
      endMs: number;
    }>;
    const characterPerformance = JSON.parse(
      await fs.readFile(characterPerformancePath, "utf-8")
    ) as {
      mouthCues: Array<unknown>;
      blinkCues: Array<unknown>;
      expressionCues: Array<unknown>;
    };
    const subtitlePresentation = JSON.parse(
      await fs.readFile(subtitlePresentationPath, "utf-8")
    ) as {
      items: Array<{ tokens: Array<{ kind: string }> }>;
    };
    const audioMixPlan = JSON.parse(await fs.readFile(audioMixPlanPath, "utf-8")) as {
      seCues: Array<unknown>;
      bgmWindows: Array<unknown>;
    };
    const chapterPlan = JSON.parse(await fs.readFile(chapterPlanPath, "utf-8")) as {
      chapters: Array<unknown>;
    };
    const codecName = await runCommand(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        previewPath,
      ],
      process.cwd()
    );

    expect(composition.renderer).toBe("remotion");
    expect(composition.shotCount).toBeGreaterThanOrEqual(2);
    expect(composition.characterCueCount).toBeGreaterThan(0);
    expect(composition.emphasisCount).toBeGreaterThan(0);
    expect(composition.audioCueCount).toBeGreaterThan(0);
    expect(composition.chapterCount).toBeGreaterThan(0);
    expect(shotPlan).toHaveLength(composition.shotCount);
    expect(shotPlan[0]?.startMs).toBe(0);
    expect(characterPerformance.mouthCues.length).toBeGreaterThan(0);
    expect(characterPerformance.expressionCues.length).toBeGreaterThan(0);
    expect(
      subtitlePresentation.items.some((item) =>
        item.tokens.some((token) => token.kind === "emphasis")
      )
    ).toBe(true);
    expect(audioMixPlan.seCues.length).toBeGreaterThan(0);
    expect(audioMixPlan.bgmWindows.length).toBeGreaterThan(0);
    expect(chapterPlan.chapters.length).toBeGreaterThan(0);
    expect(codecName).toBe("h264");
  }, 120000);

  it("Remotion 描画が失敗した場合は暗黙に FFmpeg へ逃がさずエラーにする", async () => {
    const outputRoot = createTempRoot("remotion-required");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "Remotion 必須", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId);
    await prepareMinimalInputs(projectRoot);

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      workspaceRoot: path.join(process.cwd(), "__missing_remotion_workspace__"),
      ttsProvider: "mock",
    });

    await expect(implementations.video_composition?.(ctx)).rejects.toThrow();
  }, 120000);
});
