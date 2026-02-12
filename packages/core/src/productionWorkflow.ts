import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Script } from "@ymm/shared";
import { ScriptSchema } from "@ymm/shared";
import {
  createDefaultWorkflowImplementations,
  type DefaultWorkflowOptions,
} from "./defaultWorkflow";
import type {
  WorkflowContext,
  WorkflowStepImplementation,
  WorkflowStepImplementations,
  WorkflowStepName,
} from "./index";
import { registerProjectFiles } from "./projectFile";

type JobDetails = {
  projectId: string;
  theme: string;
};

export type ProductionWorkflowOptions = DefaultWorkflowOptions & {
  retryCount?: number;
  cacheEnabled?: boolean;
};

const cacheTargets: Partial<Record<WorkflowStepName, string>> = {
  theme_selection: "theme_selection/latest/theme.json",
  script_generation: "script_generation/latest/script.json",
  title_generation: "title_generation/latest/title.json",
  tts_generation: "tts_generation/latest/audio.wav",
  character_synthesis: "character_synthesis/latest/character_motion.json",
  background_generation: "background_generation/latest/background.png",
  subtitle_generation: "subtitle_generation/latest/subtitles.ass",
  video_composition: "video_composition/latest/preview.mp4",
  audio_enhancement: "audio_enhancement/latest/enhanced.wav",
  illustration_insertion: "illustration_insertion/latest/illustration.png",
  final_encoding: "final_encoding/latest/final.mp4",
  youtube_upload: "youtube_upload/latest/youtube_upload.json",
};

export function createProductionWorkflowImplementations(
  options: ProductionWorkflowOptions = {}
): WorkflowStepImplementations {
  const base = createDefaultWorkflowImplementations(options);
  const extended: WorkflowStepImplementations = {
    theme_selection: createThemeSelectionImplementation(options),
    title_generation: createTitleGenerationImplementation(options),
    background_generation: createBackgroundGenerationImplementation(options),
    character_synthesis: createCharacterSynthesisImplementation(options),
    illustration_insertion: createIllustrationInsertionImplementation(options),
    audio_enhancement: createAudioEnhancementImplementation(options),
    youtube_upload: createYoutubeUploadImplementation(options),
  };

  const merged: WorkflowStepImplementations = {
    ...base,
    ...extended,
  };

  const wrapped: WorkflowStepImplementations = {};
  for (const [stepName, implementation] of Object.entries(merged)) {
    if (!implementation) {
      continue;
    }
    wrapped[stepName as WorkflowStepName] = withReliability(
      stepName as WorkflowStepName,
      implementation,
      options
    );
  }

  return wrapped;
}

const withReliability = (
  stepName: WorkflowStepName,
  implementation: WorkflowStepImplementation,
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => {
  const retryCount = Math.max(0, options.retryCount ?? 1);
  const cacheEnabled = options.cacheEnabled ?? true;

  return async (ctx) => {
    const outputRoot = resolveOutputRoot(ctx, options);
    const details = await loadJobDetails(ctx);
    const projectRoot = path.join(outputRoot, "projects", details.projectId);
    const workflowLogPath = path.join(projectRoot, "logs", "workflow.log");
    await fs.mkdir(path.dirname(workflowLogPath), { recursive: true });

    if (cacheEnabled && (await hasCachedOutput(projectRoot, stepName))) {
      await appendWorkflowLog(workflowLogPath, {
        event: "cache_hit",
        jobId: ctx.jobId,
        stepName,
      });
      return {
        cached: true,
        stepName,
      };
    }

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      await appendWorkflowLog(workflowLogPath, {
        event: "step_start",
        jobId: ctx.jobId,
        stepName,
        attempt,
      });
      try {
        const result = await implementation(ctx);
        await appendWorkflowLog(workflowLogPath, {
          event: "step_complete",
          jobId: ctx.jobId,
          stepName,
          attempt,
        });
        return result;
      } catch (error) {
        await appendWorkflowLog(workflowLogPath, {
          event: "step_error",
          jobId: ctx.jobId,
          stepName,
          attempt,
          message: error instanceof Error ? error.message : String(error),
        });
        if (attempt >= retryCount) {
          throw error;
        }
      }
    }
    throw new Error(`Unexpected retry state: ${stepName}`);
  };
};

const createThemeSelectionImplementation = (
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => {
  const fetchFn = options.fetchFn ?? fetch;
  return async (ctx) => {
    const outputRoot = resolveOutputRoot(ctx, options);
    const details = await loadJobDetails(ctx);
    const projectRoot = path.join(outputRoot, "projects", details.projectId);
    const stepDir = await createStepRunDir(projectRoot, "theme_selection");

    const trends = await fetchTrendCandidates(fetchFn);
    const selectedTheme = details.theme || trends[0] || "ゆっくり解説";
    const themePayload = {
      selectedTheme,
      candidates: trends,
      scoredAt: new Date().toISOString(),
    };
    const themePath = path.join(stepDir.runDir, "theme.json");
    await writeJson(themePath, themePayload);
    await syncLatest(stepDir);

    const stat = await fs.stat(themePath);
    await registerProjectFiles({
      prisma: ctx.prisma,
      jobId: ctx.jobId,
      stepName: "theme_selection",
      artifacts: [
        {
          type: "metadata",
          relativePath: toRelativePath(outputRoot, themePath),
          fileCategory: "output",
          fileSizeBytes: stat.size,
          kind: "theme_selection",
        },
      ],
    });

    return themePayload;
  };
};

const createTitleGenerationImplementation = (
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => async (ctx) => {
  const outputRoot = resolveOutputRoot(ctx, options);
  const details = await loadJobDetails(ctx);
  const projectRoot = path.join(outputRoot, "projects", details.projectId);
  const stepDir = await createStepRunDir(projectRoot, "title_generation");

  const script = await readScriptOrFallback(projectRoot, details.theme);
  const baseTheme = script.theme ?? details.theme;
  const titleCandidates = [
    `【3分解説】${baseTheme}の要点を一気に理解`,
    `${baseTheme}が伸びる理由をゆっくり整理`,
    `失敗しない${baseTheme}入門: 初心者向け`,
  ];
  const pickedTitle = pickCtrOptimizedTitle(titleCandidates);

  const titlePayload = {
    title: pickedTitle,
    candidates: titleCandidates,
    sourceTheme: baseTheme,
  };
  const titlePath = path.join(stepDir.runDir, "title.json");
  await writeJson(titlePath, titlePayload);
  await syncLatest(stepDir);

  const stat = await fs.stat(titlePath);
  await registerProjectFiles({
    prisma: ctx.prisma,
    jobId: ctx.jobId,
    stepName: "title_generation",
    artifacts: [
      {
        type: "metadata",
        relativePath: toRelativePath(outputRoot, titlePath),
        fileCategory: "output",
        fileSizeBytes: stat.size,
        kind: "title_generation",
      },
    ],
  });

  return titlePayload;
};

const createBackgroundGenerationImplementation = (
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => async (ctx) => {
  const outputRoot = resolveOutputRoot(ctx, options);
  const details = await loadJobDetails(ctx);
  const projectRoot = path.join(outputRoot, "projects", details.projectId);
  const stepDir = await createStepRunDir(projectRoot, "background_generation");

  const backgroundPath = path.join(stepDir.runDir, "background.png");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x0f172a:s=1920x1080:d=1",
      "-vf",
      "drawbox=x=0:y=0:w=1920:h=380:color=0x1d4ed8@0.48:t=fill,drawbox=x=0:y=380:w=1920:h=700:color=0x0891b2@0.3:t=fill",
      "-frames:v",
      "1",
      backgroundPath,
    ],
    path.dirname(backgroundPath)
  );

  const promptPath = path.join(stepDir.runDir, "background_prompt.txt");
  await fs.writeFile(promptPath, `${details.theme}向けの背景を生成\n`, "utf-8");
  await syncLatest(stepDir);

  const [imageStat, promptStat] = await Promise.all([
    fs.stat(backgroundPath),
    fs.stat(promptPath),
  ]);
  await registerProjectFiles({
    prisma: ctx.prisma,
    jobId: ctx.jobId,
    stepName: "background_generation",
    artifacts: [
      {
        type: "image",
        relativePath: toRelativePath(outputRoot, backgroundPath),
        fileCategory: "output",
        fileSizeBytes: imageStat.size,
        width: 1920,
        height: 1080,
      },
      {
        type: "metadata",
        relativePath: toRelativePath(outputRoot, promptPath),
        fileCategory: "output",
        fileSizeBytes: promptStat.size,
        kind: "background_prompt",
      },
    ],
  });

  return {
    backgroundPath: toRelativePath(outputRoot, backgroundPath),
    promptPath: toRelativePath(outputRoot, promptPath),
  };
};

const createCharacterSynthesisImplementation = (
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => async (ctx) => {
  const outputRoot = resolveOutputRoot(ctx, options);
  const details = await loadJobDetails(ctx);
  const projectRoot = path.join(outputRoot, "projects", details.projectId);
  const stepDir = await createStepRunDir(projectRoot, "character_synthesis");

  const timestampsPath = path.join(
    projectRoot,
    "output",
    "tts_generation",
    "latest",
    "timestamps.json"
  );
  const rawTimestamps = await readJsonSafe<Array<{ startMs: number; endMs: number; speaker: string }>>(
    timestampsPath
  );
  const motion = (rawTimestamps ?? []).map((item, index) => ({
    id: `motion-${index + 1}`,
    startMs: item.startMs,
    endMs: item.endMs,
    mouth: index % 2 === 0 ? "open" : "close",
    expression: item.speaker === "marisa" ? "smile" : "normal",
  }));

  const motionPath = path.join(stepDir.runDir, "character_motion.json");
  await writeJson(motionPath, {
    generatedAt: new Date().toISOString(),
    motion,
  });
  await syncLatest(stepDir);

  const stat = await fs.stat(motionPath);
  await registerProjectFiles({
    prisma: ctx.prisma,
    jobId: ctx.jobId,
    stepName: "character_synthesis",
    artifacts: [
      {
        type: "metadata",
        relativePath: toRelativePath(outputRoot, motionPath),
        fileCategory: "output",
        fileSizeBytes: stat.size,
        kind: "character_motion",
      },
    ],
  });

  return { motionCount: motion.length };
};

const createIllustrationInsertionImplementation = (
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => async (ctx) => {
  const outputRoot = resolveOutputRoot(ctx, options);
  const details = await loadJobDetails(ctx);
  const projectRoot = path.join(outputRoot, "projects", details.projectId);
  const stepDir = await createStepRunDir(projectRoot, "illustration_insertion");

  const illustrationPath = path.join(stepDir.runDir, "illustration.png");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x111827:s=1280x720:d=1",
      "-vf",
      "drawbox=x=160:y=130:w=960:h=460:color=0xf59e0b@0.92:t=fill,drawbox=x=220:y=190:w=840:h=340:color=0x0f172a@0.88:t=fill",
      "-frames:v",
      "1",
      illustrationPath,
    ],
    path.dirname(illustrationPath)
  );
  await syncLatest(stepDir);

  const stat = await fs.stat(illustrationPath);
  await registerProjectFiles({
    prisma: ctx.prisma,
    jobId: ctx.jobId,
    stepName: "illustration_insertion",
    artifacts: [
      {
        type: "image",
        relativePath: toRelativePath(outputRoot, illustrationPath),
        fileCategory: "output",
        fileSizeBytes: stat.size,
        width: 1280,
        height: 720,
      },
    ],
  });

  return { illustrationPath: toRelativePath(outputRoot, illustrationPath) };
};

const createAudioEnhancementImplementation = (
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => async (ctx) => {
  const outputRoot = resolveOutputRoot(ctx, options);
  const details = await loadJobDetails(ctx);
  const projectRoot = path.join(outputRoot, "projects", details.projectId);
  const stepDir = await createStepRunDir(projectRoot, "audio_enhancement");

  const sourceAudioPath = path.join(
    projectRoot,
    "output",
    "tts_generation",
    "latest",
    "audio.wav"
  );
  const enhancedPath = path.join(stepDir.runDir, "enhanced.wav");
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      sourceAudioPath,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      enhancedPath,
    ],
    path.dirname(enhancedPath)
  );
  await syncLatest(stepDir);

  const stat = await fs.stat(enhancedPath);
  await registerProjectFiles({
    prisma: ctx.prisma,
    jobId: ctx.jobId,
    stepName: "audio_enhancement",
    artifacts: [
      {
        type: "audio",
        relativePath: toRelativePath(outputRoot, enhancedPath),
        fileCategory: "output",
        fileSizeBytes: stat.size,
      },
    ],
  });

  return { enhancedPath: toRelativePath(outputRoot, enhancedPath) };
};

const createYoutubeUploadImplementation = (
  options: ProductionWorkflowOptions
): WorkflowStepImplementation => {
  const fetchFn = options.fetchFn ?? fetch;
  return async (ctx) => {
    const outputRoot = resolveOutputRoot(ctx, options);
    const details = await loadJobDetails(ctx);
    const projectRoot = path.join(outputRoot, "projects", details.projectId);
    const stepDir = await createStepRunDir(projectRoot, "youtube_upload");
    const resultPath = path.join(stepDir.runDir, "youtube_upload.json");
    const finalPath = path.join(projectRoot, "final", "final.mp4");

    const token = process.env.YOUTUBE_ACCESS_TOKEN?.trim();
    let payload: Record<string, unknown>;

    if (!token) {
      payload = {
        status: "skipped",
        reason: "YOUTUBE_ACCESS_TOKEN is missing",
      };
    } else if (!(await fileExists(finalPath))) {
      payload = {
        status: "skipped",
        reason: "final.mp4 is missing",
      };
    } else {
      const response = await fetchFn(
        "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = await response.json();
      payload = {
        status: response.ok ? "validated" : "failed",
        youtubeResponse: body,
        videoPath: toRelativePath(outputRoot, finalPath),
      };
    }

    await writeJson(resultPath, payload);
    await syncLatest(stepDir);
    const stat = await fs.stat(resultPath);
    await registerProjectFiles({
      prisma: ctx.prisma,
      jobId: ctx.jobId,
      stepName: "youtube_upload",
      artifacts: [
        {
          type: "metadata",
          relativePath: toRelativePath(outputRoot, resultPath),
          fileCategory: "output",
          fileSizeBytes: stat.size,
          kind: "youtube_upload",
        },
      ],
    });

    return payload;
  };
};

const resolveOutputRoot = (
  ctx: WorkflowContext,
  options: ProductionWorkflowOptions
): string => options.outputRoot ?? ctx.outputRoot ?? process.cwd();

const loadJobDetails = async (ctx: WorkflowContext): Promise<JobDetails> => {
  const job = await ctx.prisma.job.findUnique({
    where: { id: ctx.jobId },
    include: { project: true },
  });
  if (!job?.project) {
    throw new Error(`Job was not found: ${ctx.jobId}`);
  }
  return {
    projectId: job.projectId,
    theme: job.project.theme ?? "ゆっくり解説",
  };
};

const readScriptOrFallback = async (
  projectRoot: string,
  theme: string
): Promise<Script> => {
  const scriptPath = path.join(projectRoot, "output", "script_generation", "latest", "script.json");
  const loaded = await readJsonSafe<unknown>(scriptPath);
  if (!loaded) {
    return {
      title: `${theme}入門`,
      theme,
      lines: [
        { speaker: "reimu", text: `${theme}の概要を説明します。` },
        { speaker: "marisa", text: "要点だけ素早く押さえよう。" },
      ],
    };
  }
  return ScriptSchema.parse(loaded);
};

const createStepRunDir = async (
  projectRoot: string,
  stepName: string
): Promise<{ runDir: string; latestDir: string }> => {
  const runDir = path.join(projectRoot, "output", stepName, `run-${Date.now()}`);
  const latestDir = path.join(projectRoot, "output", stepName, "latest");
  await fs.mkdir(runDir, { recursive: true });
  return { runDir, latestDir };
};

const syncLatest = async ({
  runDir,
  latestDir,
}: {
  runDir: string;
  latestDir: string;
}): Promise<void> => {
  await fs.rm(latestDir, { recursive: true, force: true });
  await fs.cp(runDir, latestDir, { recursive: true });
};

const writeJson = async (targetPath: string, payload: unknown): Promise<void> => {
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
};

const toRelativePath = (outputRoot: string, absolutePath: string): string =>
  path.relative(outputRoot, absolutePath).replaceAll("\\", "/");

const readJsonSafe = async <T>(targetPath: string): Promise<T | null> => {
  try {
    const text = await fs.readFile(targetPath, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const hasCachedOutput = async (
  projectRoot: string,
  stepName: WorkflowStepName
): Promise<boolean> => {
  const relativePath = cacheTargets[stepName];
  if (!relativePath) {
    return false;
  }
  return fileExists(path.join(projectRoot, "output", relativePath));
};

const appendWorkflowLog = async (
  workflowLogPath: string,
  payload: {
    event: string;
    jobId: string;
    stepName: string;
    attempt?: number;
    message?: string;
  }
): Promise<void> => {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    ...payload,
  });
  await fs.appendFile(workflowLogPath, `${line}\n`, "utf-8");
};

const fetchTrendCandidates = async (fetchFn: typeof fetch): Promise<string[]> => {
  try {
    const response = await fetchFn("https://trends.google.com/trending/rss?geo=US");
    if (!response.ok) {
      return [];
    }
    const text = await response.text();
    const titles = Array.from(text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)).map(
      (match) => match[1]
    );
    return titles.filter((title) => !title.includes("Daily Search Trends")).slice(0, 10);
  } catch {
    return [];
  }
};

const pickCtrOptimizedTitle = (candidates: string[]): string =>
  [...candidates].sort((left, right) => scoreTitle(right) - scoreTitle(left))[0] ??
  "ゆっくり解説";

const scoreTitle = (title: string): number => {
  const lengthScore = title.length <= 34 ? 10 : Math.max(0, 10 - (title.length - 34));
  const keywordBonus = ["解説", "入門", "要点"].reduce(
    (sum, keyword) => sum + (title.includes(keyword) ? 2 : 0),
    0
  );
  return lengthScore + keywordBonus;
};

const runCommand = async (
  command: string,
  args: string[],
  cwd: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with code ${code}: ${stderr}`));
    });
  });
