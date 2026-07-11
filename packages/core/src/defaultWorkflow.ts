import { spawn } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import type { Script } from "@ymm/shared";
import { ScriptSchema, TimelineDataSchema } from "@ymm/shared";
import { createCharacterPerformancePlan } from "./characterPerformance";
import { createAudioMixPlan } from "./audioMixPlan";
import { createChapterPlan } from "./chapterPlan";
import { registerProjectFiles } from "./projectFile";
import type { WorkflowContext, WorkflowStepImplementations } from "./index";
import { createShotPlan } from "./shotPlanning";
import { createSubtitlePresentationPlan } from "./subtitlePresentation";
import { timelineToRemotionProps } from "./timeline";
import {
  type ScriptTimestamp,
  synthesizeTask3Speech,
  prepareTask3VisualAssets,
  type Task3TtsProvider,
} from "./task3Quality";

type Logger = {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
};

export type DefaultWorkflowOptions = {
  workspaceRoot?: string;
  outputRoot?: string;
  runIdFactory?: () => string;
  disableRemotion?: boolean;
  fetchFn?: typeof fetch;
  logger?: Logger;
  ttsProvider?: Task3TtsProvider;
  aivisBaseUrl?: string;
  allowMockTtsFallback?: boolean;
  requireCharacterAsset?: boolean;
  outputPreset?: OutputPreset;
};

export type OutputPreset = {
  width: number;
  height: number;
  fps: number;
};

type JobDetails = {
  projectId: string;
  theme: string;
};

const ASS_HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Yu Gothic,48,&H00FFFFFF,&H0000FFFF,&H00101010,&H66000000,-1,0,0,0,100,100,0,0,1,2,0,2,30,30,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const defaultLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const defaultOutputPreset: OutputPreset = { width: 1920, height: 1080, fps: 30 };

export function createDefaultWorkflowImplementations(
  options: DefaultWorkflowOptions = {}
): WorkflowStepImplementations {
  return {
    script_generation: async (ctx) => {
      const logger = options.logger ?? defaultLogger;
      const runId = (options.runIdFactory ?? defaultRunIdFactory)();
      const outputRoot = resolveOutputRoot(ctx, options);
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);
      await appendStepLog(projectRoot, "script_generation", { event: "start", jobId: ctx.jobId });

      const stepDir = await createStepRunDir(projectRoot, "script_generation", runId);
      const script = await generateScript(details.theme, options.fetchFn);
      const scriptPath = path.join(stepDir.runDir, "script.json");
      await writeJson(scriptPath, script);
      await syncLatest(stepDir);

      const scriptStat = await fs.stat(scriptPath);
      await registerProjectFiles({
        prisma: ctx.prisma,
        jobId: ctx.jobId,
        stepName: "script_generation",
        artifacts: [
          {
            type: "script",
            relativePath: toRelativePath(outputRoot, scriptPath),
            fileCategory: "output",
            fileSizeBytes: scriptStat.size,
          },
        ],
      });
      await appendStepLog(projectRoot, "script_generation", {
        event: "completed",
        jobId: ctx.jobId,
        lineCount: script.lines.length,
      });

      logger.info("script_generation completed", { scriptPath });
      return {
        scriptPath: toRelativePath(outputRoot, scriptPath),
      };
    },
    tts_generation: async (ctx) => {
      const logger = options.logger ?? defaultLogger;
      const runId = (options.runIdFactory ?? defaultRunIdFactory)();
      const outputRoot = resolveOutputRoot(ctx, options);
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);
      await appendStepLog(projectRoot, "tts_generation", { event: "start", jobId: ctx.jobId });

      const scriptPath = path.join(
        projectRoot,
        "output",
        "script_generation",
        "latest",
        "script.json"
      );
      const script = ScriptSchema.parse(await readJson(scriptPath));

      const stepDir = await createStepRunDir(projectRoot, "tts_generation", runId);
      const audioPath = path.join(stepDir.runDir, "audio.wav");
      const timestampsPath = path.join(stepDir.runDir, "timestamps.json");
      const synthesisResult = await synthesizeTask3Speech({
        script,
        runDir: stepDir.runDir,
        audioPath,
        provider: options.ttsProvider ?? "aivis",
        fetchFn: options.fetchFn ?? fetch,
        aivisBaseUrl: options.aivisBaseUrl ?? process.env.AIVIS_SPEECH_BASE_URL,
        allowMockFallback: options.allowMockTtsFallback ?? false,
      });
      await writeJson(timestampsPath, synthesisResult.timestamps);
      await syncLatest(stepDir);

      const [audioStat, timestampsStat] = await Promise.all([
        fs.stat(audioPath),
        fs.stat(timestampsPath),
      ]);
      const durationMs =
        synthesisResult.timestamps[synthesisResult.timestamps.length - 1]?.endMs ?? 0;
      await registerProjectFiles({
        prisma: ctx.prisma,
        jobId: ctx.jobId,
        stepName: "tts_generation",
        artifacts: [
          {
            type: "audio",
            relativePath: toRelativePath(outputRoot, audioPath),
            fileCategory: "output",
            fileSizeBytes: audioStat.size,
            durationMs,
            channels: 1,
            sampleRateHz: 24000,
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, timestampsPath),
            fileCategory: "output",
            fileSizeBytes: timestampsStat.size,
            kind: "timestamps",
          },
        ],
      });
      await appendStepLog(projectRoot, "tts_generation", {
        event: "completed",
        jobId: ctx.jobId,
        provider: synthesisResult.provider,
        usedStyleIds: synthesisResult.usedStyleIds,
      });

      logger.info("tts_generation completed", {
        audioPath,
        timestampsPath,
        provider: synthesisResult.provider,
      });
      return {
        provider: synthesisResult.provider,
        audioPath: toRelativePath(outputRoot, audioPath),
        timestampsPath: toRelativePath(outputRoot, timestampsPath),
        usedStyleIds: synthesisResult.usedStyleIds,
      };
    },
    subtitle_generation: async (ctx) => {
      const logger = options.logger ?? defaultLogger;
      const runId = (options.runIdFactory ?? defaultRunIdFactory)();
      const outputRoot = resolveOutputRoot(ctx, options);
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);
      await appendStepLog(projectRoot, "subtitle_generation", { event: "start", jobId: ctx.jobId });

      const scriptPath = path.join(
        projectRoot,
        "output",
        "script_generation",
        "latest",
        "script.json"
      );
      const timestampsPath = path.join(
        projectRoot,
        "output",
        "tts_generation",
        "latest",
        "timestamps.json"
      );
      const script = ScriptSchema.parse(await readJson(scriptPath));
      const timestamps = (await readJson(timestampsPath)) as ScriptTimestamp[];

      const subtitleItems = script.lines.map((line, index) => ({
        speaker: line.speaker,
        text: line.text,
        startMs: timestamps[index]?.startMs ?? 0,
        endMs: timestamps[index]?.endMs ?? (timestamps[index]?.startMs ?? 0) + 1000,
      }));
      const assText = createAssText(subtitleItems);

      const stepDir = await createStepRunDir(projectRoot, "subtitle_generation", runId);
      const subtitlesJsonPath = path.join(stepDir.runDir, "subtitles.json");
      const subtitlesAssPath = path.join(stepDir.runDir, "subtitles.ass");
      await writeJson(subtitlesJsonPath, subtitleItems);
      await fs.writeFile(subtitlesAssPath, assText, "utf-8");
      await syncLatest(stepDir);

      const [jsonStat, assStat] = await Promise.all([
        fs.stat(subtitlesJsonPath),
        fs.stat(subtitlesAssPath),
      ]);
      await registerProjectFiles({
        prisma: ctx.prisma,
        jobId: ctx.jobId,
        stepName: "subtitle_generation",
        artifacts: [
          {
            type: "subtitle",
            relativePath: toRelativePath(outputRoot, subtitlesJsonPath),
            fileCategory: "output",
            fileSizeBytes: jsonStat.size,
            format: "json",
            lineCount: subtitleItems.length,
          },
          {
            type: "subtitle",
            relativePath: toRelativePath(outputRoot, subtitlesAssPath),
            fileCategory: "output",
            fileSizeBytes: assStat.size,
            format: "ass",
            lineCount: subtitleItems.length,
          },
        ],
      });
      await appendStepLog(projectRoot, "subtitle_generation", {
        event: "completed",
        jobId: ctx.jobId,
        lineCount: subtitleItems.length,
      });

      logger.info("subtitle_generation completed", { subtitlesJsonPath, subtitlesAssPath });
      return {
        subtitlesJsonPath: toRelativePath(outputRoot, subtitlesJsonPath),
        subtitlesAssPath: toRelativePath(outputRoot, subtitlesAssPath),
      };
    },
    video_composition: async (ctx) => {
      const logger = options.logger ?? defaultLogger;
      const runId = (options.runIdFactory ?? defaultRunIdFactory)();
      const outputRoot = resolveOutputRoot(ctx, options);
      const workspaceRoot = resolveWorkspaceRoot(options);
      const outputPreset = resolveOutputPreset(options.outputPreset);
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);
      await appendStepLog(projectRoot, "video_composition", { event: "start", jobId: ctx.jobId });

      const audioPath = path.join(
        projectRoot,
        "output",
        "tts_generation",
        "latest",
        "audio.wav"
      );
      const subtitlesAssPath = path.join(
        projectRoot,
        "output",
        "subtitle_generation",
        "latest",
        "subtitles.ass"
      );
      const subtitlesJsonPath = path.join(
        projectRoot,
        "output",
        "subtitle_generation",
        "latest",
        "subtitles.json"
      );
      const scriptPath = path.join(
        projectRoot,
        "output",
        "script_generation",
        "latest",
        "script.json"
      );
      const script = ScriptSchema.parse(await readJson(scriptPath));
      const subtitleTracks = (await readJson(subtitlesJsonPath)) as ScriptTimestamp[];
      const timelineProps = await readTimelineRemotionProps(projectRoot);
      const effectiveSubtitleTracks = toEffectiveSubtitleTracks(
        timelineProps?.subtitleTracks ?? [],
        subtitleTracks
      );
      const shotPlan = createShotPlan({ script, timestamps: effectiveSubtitleTracks });
      const characterPerformance = createCharacterPerformancePlan({
        script,
        timestamps: effectiveSubtitleTracks,
      });
      const subtitlePresentation = createSubtitlePresentationPlan({
        script,
        timestamps: effectiveSubtitleTracks,
      });
      const chapterPlan = createChapterPlan({
        script,
        timestamps: effectiveSubtitleTracks,
      });

      const stepDir = await createStepRunDir(projectRoot, "video_composition", runId);
      const audioCopyPath = path.join(stepDir.runDir, "audio.wav");
      const subtitlesCopyPath = path.join(stepDir.runDir, "subtitles.ass");
      const compositionJsonPath = path.join(stepDir.runDir, "composition.json");
      const shotPlanPath = path.join(stepDir.runDir, "shot-plan.json");
      const characterPerformancePath = path.join(stepDir.runDir, "character-performance.json");
      const subtitlePresentationPath = path.join(stepDir.runDir, "subtitle-presentation.json");
      const audioMixPlanPath = path.join(stepDir.runDir, "audio-mix-plan.json");
      const chapterPlanPath = path.join(stepDir.runDir, "chapter-plan.json");
      const previewPath = path.join(stepDir.runDir, "preview.mp4");

      await Promise.all([
        fs.copyFile(audioPath, audioCopyPath),
        fs.copyFile(subtitlesAssPath, subtitlesCopyPath),
        writeJson(shotPlanPath, shotPlan),
        writeJson(characterPerformancePath, characterPerformance),
        writeJson(subtitlePresentationPath, subtitlePresentation),
        writeJson(chapterPlanPath, chapterPlan),
      ]);
      const visualAssets = await prepareTask3VisualAssets({
        projectRoot,
        workspaceRoot,
        outputRoot,
        runDir: stepDir.runDir,
        requireCharacterAsset: options.requireCharacterAsset ?? false,
      });

      const durationMs = timelineProps?.durationMs ?? (await probeMediaDurationMs(audioCopyPath));
      const usingRemotion = options.disableRemotion !== true;
      const audioMixPlan = createAudioMixPlan({
        durationMs,
        timestamps: effectiveSubtitleTracks,
        shotPlan,
        subtitlePresentation,
      });
      const audioMixAssets = await prepareRemotionAudioAssets({ runDir: stepDir.runDir, durationMs });
      const remotionAudioTracks = await resolveTimelineAudioTracks({
        outputRoot,
        projectRoot,
        audioTracks: timelineProps?.audioTracks ?? [],
      });
      await writeJson(audioMixPlanPath, {
        ...audioMixPlan,
        assets: {
          bgmPath: toRelativePath(outputRoot, audioMixAssets.bgmPath),
          ambientPath: toRelativePath(outputRoot, audioMixAssets.ambientPath),
          accentPath: toRelativePath(outputRoot, audioMixAssets.accentPath),
          transitionPath: toRelativePath(outputRoot, audioMixAssets.transitionPath),
        },
      });

      if (usingRemotion) {
        await renderWithRemotion({
          workspaceRoot,
          outputPath: previewPath,
          audioPath: audioCopyPath,
          backgroundImagePath: visualAssets.backgroundRenderPath,
          characterImagePath: visualAssets.characterRenderPath,
          subtitleTracks: effectiveSubtitleTracks,
          audioTracks: remotionAudioTracks,
          shotPlan,
          characterPerformance,
          subtitlePresentation,
          audioMixPlan: {
            ...audioMixPlan,
            assets: audioMixAssets,
          },
          chapterPlan,
          durationMs,
          outputPreset,
          title: "ゆっくり解説MVP",
          theme: details.theme,
          logger,
        });
      } else {
        await composeVideoWithFfmpeg({
          runDir: stepDir.runDir,
          backgroundPath: path.basename(visualAssets.backgroundRenderPath),
          characterPath: path.basename(visualAssets.characterRenderPath),
          subtitlesPath: path.basename(subtitlesCopyPath),
          outputPreset,
        });
      }

      await writeJson(compositionJsonPath, {
        renderer: usingRemotion ? "remotion" : "ffmpeg",
        audioPath: toRelativePath(outputRoot, audioPath),
        subtitlesPath: toRelativePath(outputRoot, subtitlesAssPath),
        backgroundImagePath: visualAssets.backgroundSourceRelativePath,
        characterImagePath: visualAssets.characterSourceRelativePath,
        durationMs,
        outputPreset,
        shotCount: shotPlan.length,
        characterCueCount:
          characterPerformance.mouthCues.length +
          characterPerformance.blinkCues.length +
          characterPerformance.expressionCues.length,
        emphasisCount: subtitlePresentation.emphasisCount,
        audioCueCount: audioMixPlan.seCues.length + audioMixPlan.bgmWindows.length,
        chapterCount: chapterPlan.chapters.length,
        manualEditSummary: timelineProps?.manualEditSummary,
      });
      await syncLatest(stepDir);

      const [
        previewStat,
        compositionStat,
        shotPlanStat,
        characterPerformanceStat,
        subtitlePresentationStat,
        audioMixPlanStat,
        chapterPlanStat,
      ] = await Promise.all([
        fs.stat(previewPath),
        fs.stat(compositionJsonPath),
        fs.stat(shotPlanPath),
        fs.stat(characterPerformancePath),
        fs.stat(subtitlePresentationPath),
        fs.stat(audioMixPlanPath),
        fs.stat(chapterPlanPath),
      ]);
      await registerProjectFiles({
        prisma: ctx.prisma,
        jobId: ctx.jobId,
        stepName: "video_composition",
        artifacts: [
          {
            type: "video",
            relativePath: toRelativePath(outputRoot, previewPath),
            fileCategory: "output",
            fileSizeBytes: previewStat.size,
            width: outputPreset.width,
            height: outputPreset.height,
            frameRate: outputPreset.fps,
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, compositionJsonPath),
            fileCategory: "intermediate",
            fileSizeBytes: compositionStat.size,
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, shotPlanPath),
            fileCategory: "intermediate",
            fileSizeBytes: shotPlanStat.size,
            kind: "shot_plan",
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, characterPerformancePath),
            fileCategory: "intermediate",
            fileSizeBytes: characterPerformanceStat.size,
            kind: "character_performance",
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, subtitlePresentationPath),
            fileCategory: "intermediate",
            fileSizeBytes: subtitlePresentationStat.size,
            kind: "subtitle_presentation",
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, audioMixPlanPath),
            fileCategory: "intermediate",
            fileSizeBytes: audioMixPlanStat.size,
            kind: "audio_mix_plan",
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, chapterPlanPath),
            fileCategory: "intermediate",
            fileSizeBytes: chapterPlanStat.size,
            kind: "chapter_plan",
          },
        ],
      });
      await appendStepLog(projectRoot, "video_composition", {
        event: "completed",
        jobId: ctx.jobId,
        renderer: usingRemotion ? "remotion" : "ffmpeg",
        characterImagePath: visualAssets.characterSourceRelativePath,
        durationMs,
        outputPreset,
        shotCount: shotPlan.length,
        characterCueCount:
          characterPerformance.mouthCues.length +
          characterPerformance.blinkCues.length +
          characterPerformance.expressionCues.length,
        emphasisCount: subtitlePresentation.emphasisCount,
        audioCueCount: audioMixPlan.seCues.length + audioMixPlan.bgmWindows.length,
        chapterCount: chapterPlan.chapters.length,
        manualEditSummary: timelineProps?.manualEditSummary,
      });

      logger.info("video_composition completed", {
        previewPath,
        renderer: usingRemotion ? "remotion" : "ffmpeg",
        shotCount: shotPlan.length,
        characterCueCount:
          characterPerformance.mouthCues.length +
          characterPerformance.blinkCues.length +
          characterPerformance.expressionCues.length,
        emphasisCount: subtitlePresentation.emphasisCount,
        audioCueCount: audioMixPlan.seCues.length + audioMixPlan.bgmWindows.length,
        chapterCount: chapterPlan.chapters.length,
        manualEditSummary: timelineProps?.manualEditSummary,
      });
      return {
        previewPath: toRelativePath(outputRoot, previewPath),
        renderer: usingRemotion ? "remotion" : "ffmpeg",
        characterImagePath: visualAssets.characterSourceRelativePath,
        backgroundImagePath: visualAssets.backgroundSourceRelativePath,
        shotCount: shotPlan.length,
        characterCueCount:
          characterPerformance.mouthCues.length +
          characterPerformance.blinkCues.length +
          characterPerformance.expressionCues.length,
        emphasisCount: subtitlePresentation.emphasisCount,
        audioCueCount: audioMixPlan.seCues.length + audioMixPlan.bgmWindows.length,
        chapterCount: chapterPlan.chapters.length,
        manualEditSummary: timelineProps?.manualEditSummary,
      };
    },
    final_encoding: async (ctx) => {
      const logger = options.logger ?? defaultLogger;
      const runId = (options.runIdFactory ?? defaultRunIdFactory)();
      const outputRoot = resolveOutputRoot(ctx, options);
      const outputPreset = resolveOutputPreset(options.outputPreset);
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);
      await appendStepLog(projectRoot, "final_encoding", { event: "start", jobId: ctx.jobId });

      const previewPath = path.join(
        projectRoot,
        "output",
        "video_composition",
        "latest",
        "preview.mp4"
      );
      const stepDir = await createStepRunDir(projectRoot, "final_encoding", runId);
      const finalPath = path.join(stepDir.runDir, "final.mp4");
      const finalCopyPath = path.join(projectRoot, "final", "final.mp4");

      await reencodeYoutubeCompatible(previewPath, finalPath, outputPreset);
      await fs.copyFile(finalPath, finalCopyPath);
      await syncLatest(stepDir);

      const [finalStat, finalCopyStat] = await Promise.all([
        fs.stat(finalPath),
        fs.stat(finalCopyPath),
      ]);
      await registerProjectFiles({
        prisma: ctx.prisma,
        jobId: ctx.jobId,
        stepName: "final_encoding",
        fileCategory: "final",
        artifacts: [
          {
            type: "video",
            relativePath: toRelativePath(outputRoot, finalPath),
            fileCategory: "final",
            fileSizeBytes: finalStat.size,
            width: outputPreset.width,
            height: outputPreset.height,
            frameRate: outputPreset.fps,
          },
          {
            type: "video",
            relativePath: toRelativePath(outputRoot, finalCopyPath),
            fileCategory: "final",
            fileSizeBytes: finalCopyStat.size,
            width: outputPreset.width,
            height: outputPreset.height,
            frameRate: outputPreset.fps,
          },
        ],
      });
      await appendStepLog(projectRoot, "final_encoding", {
        event: "completed",
        jobId: ctx.jobId,
        finalPath: toRelativePath(outputRoot, finalPath),
      });

      logger.info("final_encoding completed", { finalPath, finalCopyPath });
      return {
        finalPath: toRelativePath(outputRoot, finalPath),
        finalCopyPath: toRelativePath(outputRoot, finalCopyPath),
      };
    },
  };
}

const resolveWorkspaceRoot = (options: DefaultWorkflowOptions): string =>
  options.workspaceRoot ?? process.cwd();

const resolveOutputRoot = (
  ctx: WorkflowContext,
  options: DefaultWorkflowOptions
): string => {
  const contextRoot = (ctx as WorkflowContext & { outputRoot?: string }).outputRoot;
  return options.outputRoot ?? contextRoot ?? process.cwd();
};

const resolveOutputPreset = (preset?: OutputPreset): OutputPreset => ({
  width: Number.isFinite(preset?.width) ? Math.max(320, Math.floor(preset!.width)) : defaultOutputPreset.width,
  height: Number.isFinite(preset?.height) ? Math.max(180, Math.floor(preset!.height)) : defaultOutputPreset.height,
  fps: Number.isFinite(preset?.fps) ? Math.max(1, Math.floor(preset!.fps)) : defaultOutputPreset.fps,
});

const defaultRunIdFactory = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `run-${year}${month}${day}-${hours}${minutes}${seconds}-${now.getMilliseconds()}`;
};

const ensureProjectRoot = async (projectRoot: string): Promise<void> => {
  await Promise.all(
    ["input", "output", "intermediate", "final", "logs", "tmp"].map((directoryName) =>
      fs.mkdir(path.join(projectRoot, directoryName), { recursive: true })
    )
  );
};

const createStepRunDir = async (
  projectRoot: string,
  stepName: string,
  runId: string
): Promise<{ runDir: string; latestDir: string }> => {
  const stepRoot = path.join(projectRoot, "output", stepName);
  const runDir = path.join(stepRoot, runId);
  const latestDir = path.join(stepRoot, "latest");
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

const toRelativePath = (outputRoot: string, absolutePath: string): string =>
  path.relative(outputRoot, absolutePath).replaceAll("\\", "/");

const writeJson = async (filePath: string, payload: unknown): Promise<void> => {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
};

const readJson = async (filePath: string): Promise<unknown> => {
  const text = await fs.readFile(filePath, "utf-8");
  return JSON.parse(text);
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const appendStepLog = async (
  projectRoot: string,
  stepName: string,
  payload: Record<string, unknown>
): Promise<void> => {
  const logsDir = path.join(projectRoot, "logs");
  await fs.mkdir(logsDir, { recursive: true });
  const line = `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`;
  await Promise.all([
    fs.appendFile(path.join(logsDir, "workflow.log"), line, "utf-8"),
    fs.appendFile(path.join(logsDir, `step-${stepName}.log`), line, "utf-8"),
  ]);
};

const loadJobDetails = async (ctx: WorkflowContext): Promise<JobDetails> => {
  const job = await ctx.prisma.job.findUnique({
    where: { id: ctx.jobId },
    include: { project: true },
  });
  if (!job?.projectId || !job.project) {
    throw new Error(`Job details were not found: ${ctx.jobId}`);
  }
  return {
    projectId: job.projectId,
    theme: job.project.theme ?? "ゆっくり解説",
  };
};

const generateScript = async (theme: string, fetchFn?: typeof fetch): Promise<Script> => {
  const effectiveFetch = fetchFn ?? fetch;
  const geminiApiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!geminiApiKey) {
    return buildFallbackScript(theme);
  }

  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    const prompt =
      "あなたはゆっくり解説の脚本家です。JSONのみで返答してください。" +
      "schema={title:string,theme:string,lines:[{speaker:string,text:string,emotion?:string}]}" +
      `テーマ: ${theme}`;
    const response = await effectiveFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!text) {
      throw new Error("Gemini response was empty");
    }
    const parsed = ScriptSchema.safeParse(JSON.parse(extractJson(text)));
    if (!parsed.success) {
      throw new Error("Gemini response schema mismatch");
    }
    if (parsed.data.lines.length === 0) {
      return buildFallbackScript(theme);
    }
    return parsed.data;
  } catch {
    return buildFallbackScript(theme);
  }
};

const extractJson = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) {
    throw new Error("JSON block was not found");
  }
  return trimmed.slice(first, last + 1);
};

const buildFallbackScript = (theme: string): Script => ({
  title: `${theme}を3分で理解する`,
  theme,
  lines: [
    {
      speaker: "reimu",
      text: `${theme}の全体像を短く整理していきます。`,
      emotion: "normal",
    },
    {
      speaker: "marisa",
      text: "最初に結論から押さえると理解が早いぜ。",
      emotion: "happy",
    },
    {
      speaker: "reimu",
      text: "背景と具体例を順番に見ていきましょう。",
      emotion: "normal",
    },
    {
      speaker: "marisa",
      text: "最後に次のアクションを確認して締めるぜ。",
      emotion: "serious",
    },
  ],
});

const createAssText = (
  subtitleItems: Array<{ speaker: string; text: string; startMs: number; endMs: number }>
): string => {
  const lines = subtitleItems.map((item) => {
    const start = toAssTime(item.startMs);
    const end = toAssTime(item.endMs);
    const safeText = `${item.speaker}: ${item.text}`
      .replaceAll("\r", " ")
      .replaceAll("\n", "\\N")
      .replaceAll(",", "，");
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${safeText}`;
  });
  return `${ASS_HEADER}\n${lines.join("\n")}\n`;
};

const toAssTime = (milliseconds: number): string => {
  const totalCs = Math.floor(milliseconds / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}.${String(cs).padStart(2, "0")}`;
};

const composeVideoWithFfmpeg = async ({
  runDir,
  backgroundPath,
  characterPath,
  subtitlesPath,
  outputPreset,
}: {
  runDir: string;
  backgroundPath: string;
  characterPath: string;
  subtitlesPath: string;
  outputPreset: OutputPreset;
}): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      backgroundPath,
      "-loop",
      "1",
      "-i",
      characterPath,
      "-i",
      "audio.wav",
      "-filter_complex",
      `[0:v]scale=${outputPreset.width}:${outputPreset.height},setsar=1[bg];[1:v]scale=-1:${Math.max(
        120,
        Math.round(outputPreset.height * 0.78)
      )}[ch];[bg][ch]overlay=x=W-w-80:y=H-h-20,ass=${subtitlesPath}`,
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(outputPreset.fps),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "preview.mp4",
    ],
    runDir
  );
};

type TimelineRemotionProps = ReturnType<typeof timelineToRemotionProps>;

type ResolvedRemotionAudioTrack = {
  clipId: string;
  filePath: string;
  startMs: number;
  endMs: number;
  trimBeforeMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
};

const renderWithRemotion = async ({
  workspaceRoot,
  outputPath,
  audioPath,
  audioTracks,
  backgroundImagePath,
  characterImagePath,
  subtitleTracks,
  shotPlan,
  characterPerformance,
  subtitlePresentation,
  audioMixPlan,
  chapterPlan,
  durationMs,
  outputPreset,
  title,
  theme,
  logger,
}: {
  workspaceRoot: string;
  outputPath: string;
  audioPath: string;
  audioTracks: ResolvedRemotionAudioTrack[];
  backgroundImagePath: string;
  characterImagePath: string;
  subtitleTracks: ScriptTimestamp[];
  shotPlan: Array<{
    id: string;
    type: "wide" | "medium" | "close" | "insert";
    startMs: number;
    endMs: number;
    lineIndexes: number[];
    focusSpeaker: string;
    zoomStart: number;
    zoomEnd: number;
    panX: number;
    panY: number;
  }>;
  characterPerformance: {
    mouthCues: Array<{ startMs: number; endMs: number; openness: number; speaker: string }>;
    blinkCues: Array<{ startMs: number; endMs: number }>;
    expressionCues: Array<{
      startMs: number;
      endMs: number;
      expression: "normal" | "happy" | "serious" | "surprised";
      speaker: string;
    }>;
  };
  subtitlePresentation: {
    items: Array<{
      speaker: string;
      text: string;
      startMs: number;
      endMs: number;
      keywordBadge: string | null;
      tokens: Array<{
        text: string;
        kind: "plain" | "emphasis" | "secondary";
      }>;
    }>;
    emphasisCount: number;
  };
  audioMixPlan: {
    bgmWindows: Array<{ startMs: number; endMs: number; volume: number }>;
    ambientWindows: Array<{ startMs: number; endMs: number; volume: number }>;
    seCues: Array<{
      id: string;
      kind: "accent" | "transition";
      assetKey: "accent" | "transition";
      startMs: number;
      durationMs: number;
      volume: number;
    }>;
    assets: {
      bgmPath: string;
      ambientPath: string;
      accentPath: string;
      transitionPath: string;
    };
  };
  chapterPlan: {
    chapters: Array<{
      id: string;
      title: string;
      startMs: number;
      endMs: number;
      lineIndexes: number[];
      transitionDurationMs: number;
    }>;
  };
  durationMs: number;
  outputPreset: OutputPreset;
  title: string;
  theme: string;
  logger: Logger;
}): Promise<void> => {
  const audioTrackRouteEntries = audioTracks.map((track, index) => {
    const extension = path.extname(track.filePath) || ".wav";
    return {
      routePath: `/timeline-audio-${index}${extension}`,
      track,
    };
  });
  const assetServer = await startAssetServer({
    assets: {
      "/audio.wav": { filePath: audioPath },
      "/background.png": { filePath: backgroundImagePath },
      "/character.png": { filePath: characterImagePath },
      "/bgm.wav": { filePath: audioMixPlan.assets.bgmPath },
      "/ambient.wav": { filePath: audioMixPlan.assets.ambientPath },
      "/accent.wav": { filePath: audioMixPlan.assets.accentPath },
      "/transition.wav": { filePath: audioMixPlan.assets.transitionPath },
      ...Object.fromEntries(
        audioTrackRouteEntries.map((entry) => [entry.routePath, { filePath: entry.track.filePath }])
      ),
    },
  });
  try {
    const [{ bundle }, { selectComposition, renderMedia }] = await Promise.all([
      import("@remotion/bundler"),
      import("@remotion/renderer"),
    ]);
    const entryPoint = path.join(workspaceRoot, "packages", "remotion", "src", "index.tsx");
    const serveUrl = await bundle({
      entryPoint,
      onProgress: () => undefined,
    });
    const inputProps = {
      title,
      theme,
      subtitleTracks,
      shotPlan,
      characterPerformance,
      subtitlePresentation,
      audioMixPlan: {
        ...audioMixPlan,
        assets: {
          bgmPath: assetServer.urls["/bgm.wav"],
          ambientPath: assetServer.urls["/ambient.wav"],
          accentPath: assetServer.urls["/accent.wav"],
          transitionPath: assetServer.urls["/transition.wav"],
        },
      },
      audioTracks: audioTrackRouteEntries.map((entry) => ({
        clipId: entry.track.clipId,
        assetPath: assetServer.urls[entry.routePath],
        startMs: entry.track.startMs,
        endMs: entry.track.endMs,
        trimBeforeMs: entry.track.trimBeforeMs,
        volume: entry.track.volume,
        fadeInMs: entry.track.fadeInMs,
        fadeOutMs: entry.track.fadeOutMs,
      })),
      chapterPlan,
      durationMs,
      outputPreset,
      audioPath: assetServer.urls["/audio.wav"],
      backgroundImagePath: assetServer.urls["/background.png"],
      characterImagePath: assetServer.urls["/character.png"],
    };
    const composition = await selectComposition({
      serveUrl,
      id: "YmmComposition",
      inputProps,
    });
    await renderMedia({
      codec: "h264",
      serveUrl,
      composition,
      outputLocation: outputPath,
      inputProps,
      logLevel: "error",
    });
  } catch (error) {
    logger.error("Remotion rendering failed.", {
      error: error instanceof Error ? error.message : String(error),
      outputPath,
    });
    throw error;
  } finally {
    await assetServer.close();
  }
};

const readTimelineRemotionProps = async (
  projectRoot: string
): Promise<TimelineRemotionProps | null> => {
  const timelinePath = path.join(projectRoot, "intermediate", "timeline.json");
  if (!(await fileExists(timelinePath))) {
    return null;
  }
  const timeline = TimelineDataSchema.parse(await readJson(timelinePath));
  return timelineToRemotionProps(timeline);
};

const toEffectiveSubtitleTracks = (
  manualSubtitleTracks: TimelineRemotionProps["subtitleTracks"],
  fallbackTracks: ScriptTimestamp[]
): ScriptTimestamp[] => {
  if (manualSubtitleTracks.length === 0) {
    return fallbackTracks;
  }
  return manualSubtitleTracks.map((track, index) => ({
    index,
    speaker: track.speaker,
    text: track.text,
    startMs: track.startMs,
    endMs: track.endMs,
  }));
};

const resolveTimelineAudioTracks = async ({
  outputRoot,
  projectRoot,
  audioTracks,
}: {
  outputRoot: string;
  projectRoot: string;
  audioTracks: TimelineRemotionProps["audioTracks"];
}): Promise<ResolvedRemotionAudioTrack[]> =>
  Promise.all(
    audioTracks.map(async (track) => ({
      clipId: track.clipId,
      filePath: await resolveTimelineAssetPath({
        outputRoot,
        projectRoot,
        assetPath: track.assetPath,
      }),
      startMs: track.startMs,
      endMs: track.endMs,
      trimBeforeMs: track.trimBeforeMs,
      volume: track.volume,
      fadeInMs: track.fadeInMs,
      fadeOutMs: track.fadeOutMs,
    }))
  );

const resolveTimelineAssetPath = async ({
  outputRoot,
  projectRoot,
  assetPath,
}: {
  outputRoot: string;
  projectRoot: string;
  assetPath: string;
}): Promise<string> => {
  if (path.isAbsolute(assetPath)) {
    return assetPath;
  }

  const normalized = assetPath.replaceAll("/", path.sep);
  const candidates = [
    path.join(projectRoot, normalized),
    path.join(outputRoot, normalized),
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Timeline asset was not found: ${assetPath}`);
};

const startAssetServer = async ({
  assets,
}: {
  assets: Record<string, { filePath: string }>;
}): Promise<{
  urls: Record<string, string>;
  close: () => Promise<void>;
}> => {
  const assetMap = new Map<string, string>(
    Object.entries(assets).map(([routePath, value]) => [routePath, value.filePath])
  );

  // Remotion のブラウザ実行から参照できるよう、ローカル成果物を一時HTTP配信する。
  const server = createServer((request, response) => {
    const requestPath = request.url ? request.url.split("?")[0] : "/";
    const targetPath = assetMap.get(requestPath);
    if (!targetPath) {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    const contentType = guessContentType(targetPath);
    response.setHeader("Content-Type", contentType);
    const stream = createReadStream(targetPath);
    stream.on("error", () => {
      response.statusCode = 500;
      response.end("failed to read asset");
    });
    stream.pipe(response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine temporary asset server address.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    urls: Object.fromEntries(
      Array.from(assetMap.keys()).map((routePath) => [routePath, `${baseUrl}${routePath}`])
    ),
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
};

const guessContentType = (targetPath: string): string => {
  const extension = path.extname(targetPath).toLowerCase();
  if (extension === ".wav") {
    return "audio/wav";
  }
  if (extension === ".mp3") {
    return "audio/mpeg";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "application/octet-stream";
};

const prepareRemotionAudioAssets = async ({
  runDir,
  durationMs,
}: {
  runDir: string;
  durationMs: number;
}): Promise<{
  bgmPath: string;
  ambientPath: string;
  accentPath: string;
  transitionPath: string;
}> => {
  const durationSec = Math.max(1, durationMs / 1000);
  const bgmPath = path.join(runDir, "bgm.wav");
  const ambientPath = path.join(runDir, "ambient.wav");
  const accentPath = path.join(runDir, "accent.wav");
  const transitionPath = path.join(runDir, "transition.wav");

  // Remotion でミックスする音源を最小構成で生成する。
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:sample_rate=48000:duration=${durationSec.toFixed(3)}`,
      "-c:a",
      "pcm_s16le",
      bgmPath,
    ],
    runDir
  );
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anoisesrc=color=pink:sample_rate=48000:duration=${durationSec.toFixed(3)}`,
      "-af",
      "highpass=f=120,lowpass=f=1800",
      "-c:a",
      "pcm_s16le",
      ambientPath,
    ],
    runDir
  );
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=960:sample_rate=48000:duration=0.320",
      "-af",
      "afade=t=out:st=0.12:d=0.20",
      "-c:a",
      "pcm_s16le",
      accentPath,
    ],
    runDir
  );
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=420:sample_rate=48000:duration=0.420",
      "-af",
      "afade=t=in:st=0:d=0.06,afade=t=out:st=0.22:d=0.20",
      "-c:a",
      "pcm_s16le",
      transitionPath,
    ],
    runDir
  );

  return {
    bgmPath,
    ambientPath,
    accentPath,
    transitionPath,
  };
};

const probeMediaDurationMs = async (targetPath: string): Promise<number> => {
  const stdout = await runCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      targetPath,
    ],
    path.dirname(targetPath)
  );
  const durationSec = Number(stdout.trim());
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`Could not determine media duration: ${targetPath}`);
  }
  return Math.max(1, Math.round(durationSec * 1000));
};

const reencodeYoutubeCompatible = async (
  inputPath: string,
  outputPath: string,
  outputPreset: OutputPreset
): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale=${outputPreset.width}:${outputPreset.height},fps=${outputPreset.fps}`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-profile:v",
      "high",
      "-level:v",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-b:v",
      "6000k",
      "-maxrate",
      "8000k",
      "-bufsize",
      "12000k",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    ],
    path.dirname(outputPath)
  );
};

const runCommand = async (
  command: string,
  args: string[],
  cwd: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    const processRef = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    processRef.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    processRef.on("error", (error) => reject(error));
    processRef.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
