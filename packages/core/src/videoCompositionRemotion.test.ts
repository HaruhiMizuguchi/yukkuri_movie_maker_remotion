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

const createContext = (
  projectId: string,
  theme: string,
  outputRoot: string,
): WorkflowContext =>
  ({
    jobId: "job-remotion-video",
    prisma: createPrismaMock(projectId, theme),
    outputRoot,
  }) as WorkflowContext;

const createTempRoot = (suffix: string): string =>
  path.join(
    process.cwd(),
    "outputs",
    "test_evidence",
    "remotion_video",
    `${suffix}-${Date.now()}`,
  );

const runCommand = async (
  command: string,
  args: string[],
  cwd: string,
): Promise<string> =>
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
  await fs.writeFile(
    filePath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
};

const prepareMinimalInputs = async (projectRoot: string): Promise<void> => {
  await writeJson(
    path.join(
      projectRoot,
      "output",
      "script_generation",
      "latest",
      "script.json",
    ),
    {
      title: "Remotion テスト",
      theme: "Remotion 標準経路",
      lines: [
        { speaker: "reimu", text: "最初の字幕です。" },
        { speaker: "marisa", text: "二つ目の字幕です。" },
      ],
    },
  );
  await writeJson(
    path.join(
      projectRoot,
      "output",
      "subtitle_generation",
      "latest",
      "subtitles.json",
    ),
    [
      {
        index: 0,
        speaker: "reimu",
        text: "最初の字幕です。",
        startMs: 0,
        endMs: 1400,
      },
      {
        index: 1,
        speaker: "marisa",
        text: "二つ目の字幕です。",
        startMs: 1400,
        endMs: 2800,
      },
    ],
  );
  await fs.mkdir(
    path.join(projectRoot, "output", "subtitle_generation", "latest"),
    { recursive: true },
  );
  await fs.writeFile(
    path.join(
      projectRoot,
      "output",
      "subtitle_generation",
      "latest",
      "subtitles.ass",
    ),
    "[Script Info]\n[V4+ Styles]\n[Events]\nDialogue: 0,0:00:00.00,0:00:01.40,Default,,0,0,0,,reimu: 最初の字幕です。\nDialogue: 0,0:00:01.40,0:00:02.80,Default,,0,0,0,,marisa: 二つ目の字幕です。\n",
    "utf-8",
  );
  await fs.mkdir(path.join(projectRoot, "output", "tts_generation", "latest"), {
    recursive: true,
  });
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
    process.cwd(),
  );
};

describe("video composition remotion", () => {
  it("手動編集タイムラインの尺と字幕を Remotion 出力へ反映する", async () => {
    const outputRoot = createTempRoot("timeline-remotion");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "手動編集反映", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId);
    await prepareMinimalInputs(projectRoot);
    await writeJson(path.join(projectRoot, "intermediate", "timeline.json"), {
      playbackRange: { inMs: 900, outMs: 2400 },
      markers: [{ id: "mk-1", timeMs: 1200, label: "手動確認" }],
      tracks: [
        {
          id: "track-audio",
          name: "音声",
          type: "audio",
          clips: [
            {
              id: "audio-main",
              assetType: "audio",
              assetPath: "output/tts_generation/latest/audio.wav",
              startMs: 0,
              durationMs: 2800,
              inMs: 0,
              outMs: 2800,
              volume: 1,
            },
          ],
        },
        {
          id: "track-subtitle",
          name: "字幕",
          type: "subtitle",
          clips: [
            {
              id: "manual-sub-1",
              assetType: "subtitle",
              assetPath: "output/subtitle_generation/latest/subtitles.json",
              startMs: 1000,
              durationMs: 900,
              text: "手動編集字幕",
              style: "editor",
            },
          ],
        },
      ],
    });

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "mock",
    });
    await implementations.video_composition?.(ctx);

    const compositionPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "composition.json",
    );
    const composition = JSON.parse(
      await fs.readFile(compositionPath, "utf-8"),
    ) as {
      durationMs: number;
      manualEditSummary?: {
        playbackRangeApplied: boolean;
        subtitleClipCount: number;
        markerCount: number;
      };
    };

    expect(composition.durationMs).toBe(1500);
    expect(composition.manualEditSummary).toMatchObject({
      playbackRangeApplied: true,
      subtitleClipCount: 1,
      markerCount: 1,
    });
  }, 120000);

  it("video_composition はデフォルトで Remotion を正規経路として使う", async () => {
    const outputRoot = createTempRoot("default-remotion");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "Remotion 標準経路", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId);
    await prepareMinimalInputs(projectRoot);
    await writeJson(path.join(projectRoot, "intermediate", "timeline.json"), {
      playbackRange: { inMs: 0, outMs: 2400 },
      markers: [{ id: "mk-start", timeMs: 0, label: "start" }],
      tracks: [
        {
          id: "track-audio",
          name: "音声",
          type: "audio",
          clips: [
            {
              id: "audio-main",
              assetType: "audio",
              assetPath: "output/tts_generation/latest/audio.wav",
              startMs: 0,
              durationMs: 2400,
              inMs: 0,
              outMs: 2400,
              volume: 1,
            },
          ],
        },
        {
          id: "track-subtitle",
          name: "字幕",
          type: "subtitle",
          clips: [
            {
              id: "sub-1",
              assetType: "subtitle",
              assetPath: "output/subtitle_generation/latest/subtitles.json",
              startMs: 0,
              durationMs: 1200,
              text: "最初の字幕です。",
              style: "reimu",
            },
            {
              id: "sub-2",
              assetType: "subtitle",
              assetPath: "output/subtitle_generation/latest/subtitles.json",
              startMs: 1200,
              durationMs: 1200,
              text: "二つ目の字幕です。",
              style: "marisa",
            },
          ],
        },
      ],
    });

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "mock",
    });
    await implementations.video_composition?.(ctx);

    const compositionPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "composition.json",
    );
    const previewPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "preview.mp4",
    );
    const shotPlanPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "shot-plan.json",
    );
    const characterPerformancePath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "character-performance.json",
    );
    const subtitlePresentationPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "subtitle-presentation.json",
    );
    const audioMixPlanPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "audio-mix-plan.json",
    );
    const chapterPlanPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "chapter-plan.json",
    );
    const composition = JSON.parse(
      await fs.readFile(compositionPath, "utf-8"),
    ) as {
      renderer: string;
      shotCount: number;
      characterCueCount: number;
      emphasisCount: number;
      audioCueCount: number;
      chapterCount: number;
      durationMs: number;
      timelineSynchronization: {
        audioClipsAdjusted: number;
        subtitleClipsAdjusted: number;
        playbackRangeAdjusted: boolean;
      };
    };
    const shotPlan = JSON.parse(
      await fs.readFile(shotPlanPath, "utf-8"),
    ) as Array<{
      startMs: number;
      endMs: number;
    }>;
    const characterPerformance = JSON.parse(
      await fs.readFile(characterPerformancePath, "utf-8"),
    ) as {
      mouthCues: Array<unknown>;
      blinkCues: Array<unknown>;
      expressionCues: Array<unknown>;
    };
    const subtitlePresentation = JSON.parse(
      await fs.readFile(subtitlePresentationPath, "utf-8"),
    ) as {
      items: Array<{ tokens: Array<{ kind: string }> }>;
    };
    const audioMixPlan = JSON.parse(
      await fs.readFile(audioMixPlanPath, "utf-8"),
    ) as {
      seCues: Array<unknown>;
      bgmWindows: Array<unknown>;
    };
    const chapterPlan = JSON.parse(
      await fs.readFile(chapterPlanPath, "utf-8"),
    ) as {
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
      process.cwd(),
    );

    expect(composition.renderer).toBe("remotion");
    expect(composition.durationMs).toBe(2800);
    expect(composition.timelineSynchronization).toMatchObject({
      audioClipsAdjusted: 1,
      subtitleClipsAdjusted: 2,
      playbackRangeAdjusted: true,
    });
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
        item.tokens.some((token) => token.kind === "emphasis"),
      ),
    ).toBe(true);
    expect(audioMixPlan.seCues.length).toBeGreaterThan(0);
    expect(audioMixPlan.bgmWindows.length).toBeGreaterThan(0);
    expect(chapterPlan.chapters.length).toBeGreaterThan(0);
    expect(codecName).toBe("h264");
  }, 120000);

  it("出力プリセットを合成メタデータへ反映する", async () => {
    const outputRoot = createTempRoot("preset-remotion");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "出力プリセット", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId);
    await prepareMinimalInputs(projectRoot);

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "mock",
      disableRemotion: true,
      outputPreset: { width: 640, height: 360, fps: 24 },
    });
    await implementations.video_composition?.(ctx);

    const compositionPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "composition.json",
    );
    const composition = JSON.parse(
      await fs.readFile(compositionPath, "utf-8"),
    ) as {
      outputPreset?: { width: number; height: number; fps: number };
    };
    expect(composition.outputPreset).toEqual({
      width: 640,
      height: 360,
      fps: 24,
    });

    const previewPath = path.join(
      projectRoot,
      "output",
      "video_composition",
      "latest",
      "preview.mp4",
    );
    const dimensions = await runCommand(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate",
        "-of",
        "csv=p=0",
        previewPath,
      ],
      process.cwd(),
    );
    expect(dimensions).toContain("640,360,24/1");
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

  it("完成動画を分割・トリムして内蔵音声付きで再合成できる", async () => {
    const outputRoot = createTempRoot("final-video-editor");
    const projectId = `project-${Date.now()}`;
    const ctx = createContext(projectId, "完成動画編集", outputRoot);
    const projectRoot = path.join(outputRoot, "projects", projectId);
    await prepareMinimalInputs(projectRoot);
    await fs.mkdir(path.join(projectRoot, "final"), { recursive: true });
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=640x360:rate=24:duration=3",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=660:sample_rate=48000:duration=3",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        path.join(projectRoot, "final", "final.mp4"),
      ],
      process.cwd(),
    );
    await writeJson(path.join(projectRoot, "intermediate", "timeline.json"), {
      editingMode: "final-video",
      playbackRange: { inMs: 0, outMs: 2000 },
      markers: [],
      tracks: [
        {
          id: "track-final-video",
          name: "完成動画",
          type: "video",
          clips: [
            {
              id: "video-part-1",
              assetType: "video",
              assetPath: "final/final.mp4",
              startMs: 0,
              durationMs: 1000,
              inMs: 400,
              outMs: 1400,
              volume: 0.7,
              timingMode: "manual",
            },
            {
              id: "video-part-2",
              assetType: "video",
              assetPath: "final/final.mp4",
              startMs: 1000,
              durationMs: 1000,
              inMs: 1800,
              outMs: 2800,
              volume: 0.7,
              timingMode: "manual",
            },
          ],
        },
        {
          id: "track-overlay-subtitle",
          name: "追加テロップ",
          type: "subtitle",
          clips: [
            {
              id: "overlay-1",
              assetType: "subtitle",
              assetPath: "manual",
              startMs: 250,
              durationMs: 750,
              text: "完成動画に追記",
              style: "editor",
              timingMode: "manual",
            },
          ],
        },
        {
          id: "track-audio",
          name: "生成音声（無効）",
          type: "audio",
          muted: true,
          clips: [],
        },
      ],
    });

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "mock",
      outputPreset: { width: 640, height: 360, fps: 24 },
    });
    await implementations.video_composition?.(ctx);
    await implementations.final_encoding?.(ctx);

    const finalPath = path.join(projectRoot, "final", "final.mp4");
    const composition = JSON.parse(
      await fs.readFile(
        path.join(
          projectRoot,
          "output",
          "video_composition",
          "latest",
          "composition.json",
        ),
        "utf-8",
      ),
    ) as {
      durationMs: number;
      finalVideoEditMode: boolean;
      manualEditSummary: { videoClipCount: number; audioClipCount: number };
    };
    const streams = await runCommand(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name",
        "-of",
        "csv=p=0",
        finalPath,
      ],
      process.cwd(),
    );

    expect(composition).toMatchObject({
      durationMs: 2000,
      finalVideoEditMode: true,
      manualEditSummary: { videoClipCount: 2, audioClipCount: 0 },
    });
    expect(streams).toContain("h264,video");
    expect(streams).toContain("aac,audio");
    expect((await fs.stat(finalPath)).size).toBeGreaterThan(10_000);
  }, 120000);
});
