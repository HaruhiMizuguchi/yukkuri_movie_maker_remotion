import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

import {
  createDefaultWorkflowImplementations,
  type WorkflowContext,
} from "./index";

type PrismaMockResult = {
  prisma: any;
  registeredFiles: Array<any>;
};

const createPrismaMock = (projectId: string, theme: string): PrismaMockResult => {
  const registeredFiles: Array<any> = [];
  const prisma: any = {
    workflowStep: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    projectFile: {
      createMany: vi.fn().mockImplementation(async ({ data }) => {
        registeredFiles.push(...data);
        return { count: data.length };
      }),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-task3-quality",
        projectId,
        mode: "full",
        project: { id: projectId, theme },
      }),
    },
  };
  return { prisma, registeredFiles };
};

const createContext = (projectId: string, theme: string, outputRoot: string): WorkflowContext => {
  const { prisma } = createPrismaMock(projectId, theme);
  return {
    jobId: "job-task3-quality",
    prisma,
    outputRoot,
  } as WorkflowContext;
};

const writeJson = async (filePath: string, payload: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
};

const createTempRoot = (suffix: string): string =>
  path.join(process.cwd(), "outputs", "test_evidence", "task3_quality", `${suffix}-${Date.now()}`);

const runCommand = async (command: string, args: string[], cwd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`${command} failed: ${stderr}`));
    });
  });

const ffprobeDuration = async (filePath: string): Promise<number> => {
  const raw = await runCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    process.cwd()
  );
  return Number(raw);
};

describe("task3 module quality", () => {
  it("script_generation: JSON構造と最低限の台本品質を満たす", async () => {
    const outputRoot = createTempRoot("script");
    const projectId = `project-${Date.now()}`;
    const { prisma } = createPrismaMock(projectId, "AIで学ぶ宇宙開発");
    const ctx = { jobId: "job-task3-quality", prisma, outputRoot } as WorkflowContext;
    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "mock",
      fetchFn: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "宇宙開発の現在地",
                      theme: "AIで学ぶ宇宙開発",
                      lines: [
                        { speaker: "reimu", text: "宇宙開発の基本を整理します。" },
                        { speaker: "marisa", text: "重要なポイントを3つに絞って解説するぜ。" },
                        { speaker: "reimu", text: "最後に今後の展望を確認しましょう。" },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      }) as any,
    });

    await implementations.script_generation?.(ctx);

    const scriptPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "script_generation",
      "latest",
      "script.json"
    );
    const script = JSON.parse(await fs.readFile(scriptPath, "utf-8")) as {
      lines: Array<{ text: string }>;
    };
    expect(script.lines.length).toBeGreaterThanOrEqual(3);
    expect(script.lines.every((line) => line.text.length >= 8)).toBe(true);
  });

  it("tts_generation(mock): 台本行数に対応したタイムスタンプと音声を生成する", async () => {
    const outputRoot = createTempRoot("tts-mock");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "音声合成テスト", outputRoot);
    await writeJson(
      path.join(
        outputRoot,
        "projects",
        projectId,
        "output",
        "script_generation",
        "latest",
        "script.json"
      ),
      {
        title: "テスト",
        theme: "音声合成テスト",
        lines: [
          { speaker: "reimu", text: "最初のセリフです。" },
          { speaker: "marisa", text: "二つ目のセリフです。" },
        ],
      }
    );

    const implementations = createDefaultWorkflowImplementations({ outputRoot, ttsProvider: "mock" });
    await implementations.tts_generation?.(ctx);

    const audioPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "tts_generation",
      "latest",
      "audio.wav"
    );
    const timestampsPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "tts_generation",
      "latest",
      "timestamps.json"
    );

    const duration = await ffprobeDuration(audioPath);
    const timestamps = JSON.parse(await fs.readFile(timestampsPath, "utf-8")) as Array<any>;
    expect(duration).toBeGreaterThan(1.5);
    expect(timestamps).toHaveLength(2);
    expect(timestamps[0].endMs).toBeLessThanOrEqual(timestamps[1].startMs);
  });

  it("subtitle_generation: ASSとJSONが同じ行数で生成される", async () => {
    const outputRoot = createTempRoot("subtitle");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "字幕テスト", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId, "output");

    await writeJson(path.join(projectRoot, "script_generation", "latest", "script.json"), {
      title: "字幕",
      theme: "字幕テスト",
      lines: [
        { speaker: "reimu", text: "字幕の1行目です。" },
        { speaker: "marisa", text: "字幕の2行目です。" },
      ],
    });
    await writeJson(path.join(projectRoot, "tts_generation", "latest", "timestamps.json"), [
      { index: 0, speaker: "reimu", text: "字幕の1行目です。", startMs: 0, endMs: 1800 },
      { index: 1, speaker: "marisa", text: "字幕の2行目です。", startMs: 1800, endMs: 3600 },
    ]);

    const implementations = createDefaultWorkflowImplementations({ outputRoot, ttsProvider: "mock" });
    await implementations.subtitle_generation?.(ctx);

    const assPath = path.join(projectRoot, "subtitle_generation", "latest", "subtitles.ass");
    const jsonPath = path.join(projectRoot, "subtitle_generation", "latest", "subtitles.json");
    const assText = await fs.readFile(assPath, "utf-8");
    const json = JSON.parse(await fs.readFile(jsonPath, "utf-8")) as Array<any>;
    const dialogueCount = assText.split("\n").filter((line) => line.startsWith("Dialogue:")).length;

    expect(json).toHaveLength(2);
    expect(dialogueCount).toBe(2);
  });

  it("video_composition: 立ち絵素材を優先して合成する", async () => {
    const outputRoot = createTempRoot("video");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "動画合成テスト", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId);

    await fs.mkdir(path.join(projectRoot, "input", "assets", "characters"), { recursive: true });
    const customCharacterPath = path.join(projectRoot, "input", "assets", "characters", "main.png");
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0xff66aa:s=640x900:d=1",
        "-frames:v",
        "1",
        customCharacterPath,
      ],
      process.cwd()
    );

    await writeJson(path.join(projectRoot, "output", "subtitle_generation", "latest", "subtitles.json"), [
      { index: 0, speaker: "reimu", text: "動画の字幕", startMs: 0, endMs: 2000 },
    ]);
    await fs.mkdir(path.join(projectRoot, "output", "subtitle_generation", "latest"), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, "output", "subtitle_generation", "latest", "subtitles.ass"),
      "[Script Info]\n[V4+ Styles]\n[Events]\nDialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,reimu: 動画の字幕\n",
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
        "sine=frequency=440:duration=2",
        path.join(projectRoot, "output", "tts_generation", "latest", "audio.wav"),
      ],
      process.cwd()
    );

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "mock",
      disableRemotion: true,
    });
    await implementations.video_composition?.(ctx);

    const compositionPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "composition.json"
    );
    const composition = JSON.parse(await fs.readFile(compositionPath, "utf-8")) as {
      characterImagePath: string;
    };
    expect(composition.characterImagePath).toContain("characters/main.png");
  });

  it("final_encoding: h264/mp4で最終出力を生成する", async () => {
    const outputRoot = createTempRoot("final");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "最終エンコード", outputRoot);
    const previewPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "video_composition",
      "latest",
      "preview.mp4"
    );

    await fs.mkdir(path.dirname(previewPath), { recursive: true });
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0x1f2937:s=1280x720:d=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        previewPath,
      ],
      process.cwd()
    );

    const implementations = createDefaultWorkflowImplementations({ outputRoot, ttsProvider: "mock" });
    await implementations.final_encoding?.(ctx);

    const finalPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "final_encoding",
      "latest",
      "final.mp4"
    );
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
        finalPath,
      ],
      process.cwd()
    );

    expect(codecName).toBe("h264");
  });
});
