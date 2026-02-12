import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Script } from "@ymm/shared";
import { ScriptSchema } from "@ymm/shared";
import { registerProjectFiles } from "./projectFile";
import type { WorkflowContext, WorkflowStepImplementations } from "./index";

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
};

type JobDetails = {
  projectId: string;
  theme: string;
};

type ScriptTimestamp = {
  index: number;
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
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

      const scriptPath = path.join(
        projectRoot,
        "output",
        "script_generation",
        "latest",
        "script.json"
      );
      const script = ScriptSchema.parse(await readJson(scriptPath));
      const timestamps = createTimestamps(script);

      const stepDir = await createStepRunDir(projectRoot, "tts_generation", runId);
      const audioPath = path.join(stepDir.runDir, "audio.wav");
      const timestampsPath = path.join(stepDir.runDir, "timestamps.json");
      await synthesizeToneAudio(audioPath, timestamps[timestamps.length - 1]?.endMs ?? 3000);
      await writeJson(timestampsPath, timestamps);
      await syncLatest(stepDir);

      const [audioStat, timestampsStat] = await Promise.all([
        fs.stat(audioPath),
        fs.stat(timestampsPath),
      ]);
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
            durationMs: timestamps[timestamps.length - 1]?.endMs ?? 0,
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, timestampsPath),
            fileCategory: "output",
            fileSizeBytes: timestampsStat.size,
          },
        ],
      });

      logger.info("tts_generation completed", { audioPath, timestampsPath });
      return {
        audioPath: toRelativePath(outputRoot, audioPath),
        timestampsPath: toRelativePath(outputRoot, timestampsPath),
      };
    },
    subtitle_generation: async (ctx) => {
      const logger = options.logger ?? defaultLogger;
      const runId = (options.runIdFactory ?? defaultRunIdFactory)();
      const outputRoot = resolveOutputRoot(ctx, options);
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);

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
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);

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
      const subtitleTracks = (await readJson(subtitlesJsonPath)) as ScriptTimestamp[];

      const stepDir = await createStepRunDir(projectRoot, "video_composition", runId);
      const audioCopyPath = path.join(stepDir.runDir, "audio.wav");
      const subtitlesCopyPath = path.join(stepDir.runDir, "subtitles.ass");
      const backgroundImagePath = path.join(stepDir.runDir, "background.png");
      const characterImagePath = path.join(stepDir.runDir, "character.png");
      const compositionJsonPath = path.join(stepDir.runDir, "composition.json");
      const previewPath = path.join(stepDir.runDir, "preview.mp4");

      await Promise.all([
        fs.copyFile(audioPath, audioCopyPath),
        fs.copyFile(subtitlesAssPath, subtitlesCopyPath),
      ]);
      await createPlaceholderBackground(backgroundImagePath);
      await createPlaceholderCharacter(characterImagePath);

      const remotionRendered =
        options.disableRemotion === true
          ? false
          : await tryRemotionRender({
              workspaceRoot: resolveWorkspaceRoot(options),
              outputPath: previewPath,
              audioPath: audioCopyPath,
              backgroundImagePath,
              characterImagePath,
              subtitleTracks,
              title: "ゆっくり解説MVP",
              theme: details.theme,
              logger,
            });

      if (!remotionRendered) {
        await composeVideoWithFfmpeg(stepDir.runDir);
      }

      await writeJson(compositionJsonPath, {
        renderer: remotionRendered ? "remotion" : "ffmpeg",
        audioPath: "audio.wav",
        subtitlesPath: "subtitles.ass",
        backgroundImagePath: "background.png",
        characterImagePath: "character.png",
      });
      await syncLatest(stepDir);

      const [previewStat, compositionStat] = await Promise.all([
        fs.stat(previewPath),
        fs.stat(compositionJsonPath),
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
            width: 1920,
            height: 1080,
            frameRate: 30,
          },
          {
            type: "metadata",
            relativePath: toRelativePath(outputRoot, compositionJsonPath),
            fileCategory: "intermediate",
            fileSizeBytes: compositionStat.size,
          },
        ],
      });

      logger.info("video_composition completed", {
        previewPath,
        renderer: remotionRendered ? "remotion" : "ffmpeg",
      });
      return {
        previewPath: toRelativePath(outputRoot, previewPath),
        renderer: remotionRendered ? "remotion" : "ffmpeg",
      };
    },
    final_encoding: async (ctx) => {
      const logger = options.logger ?? defaultLogger;
      const runId = (options.runIdFactory ?? defaultRunIdFactory)();
      const outputRoot = resolveOutputRoot(ctx, options);
      const details = await loadJobDetails(ctx);
      const projectRoot = path.join(outputRoot, "projects", details.projectId);
      await ensureProjectRoot(projectRoot);

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

      await reencodeYoutubeCompatible(previewPath, finalPath);
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
            width: 1920,
            height: 1080,
            frameRate: 30,
          },
          {
            type: "video",
            relativePath: toRelativePath(outputRoot, finalCopyPath),
            fileCategory: "final",
            fileSizeBytes: finalCopyStat.size,
            width: 1920,
            height: 1080,
            frameRate: 30,
          },
        ],
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
  const geminiApiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!geminiApiKey || !fetchFn) {
    return buildFallbackScript(theme);
  }

  try {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    const prompt =
      "あなたはゆっくり解説の脚本家です。JSONのみで返答してください。" +
      "schema={title:string,theme:string,lines:[{speaker:string,text:string,emotion?:string}]}" +
      `テーマ: ${theme}`;
    const response = await fetchFn(url, {
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

const createTimestamps = (script: Script): ScriptTimestamp[] => {
  let cursor = 0;
  return script.lines.map((line, index) => {
    const duration = Math.max(1400, line.text.length * 105);
    const startMs = cursor;
    const endMs = startMs + duration;
    cursor = endMs;
    return {
      index,
      speaker: line.speaker,
      text: line.text,
      startMs,
      endMs,
    };
  });
};

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

const synthesizeToneAudio = async (outputPath: string, durationMs: number): Promise<void> => {
  const seconds = Math.max(1, durationMs / 1000).toFixed(3);
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=660:sample_rate=44100:duration=${seconds}`,
      "-c:a",
      "pcm_s16le",
      outputPath,
    ],
    path.dirname(outputPath)
  );
};

const createPlaceholderBackground = async (outputPath: string): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x1f2937:s=1920x1080:d=1",
      "-vf",
      "drawbox=x=0:y=0:w=1920:h=360:color=0x0ea5e9@0.35:t=fill",
      "-frames:v",
      "1",
      outputPath,
    ],
    path.dirname(outputPath)
  );
};

const createPlaceholderCharacter = async (outputPath: string): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black@0.0:s=640x900:d=1",
      "-vf",
      [
        "drawbox=x=120:y=60:w=400:h=780:color=0xfef08a@0.95:t=fill",
        "drawbox=x=210:y=170:w=70:h=70:color=0x0f172a@0.92:t=fill",
        "drawbox=x=360:y=170:w=70:h=70:color=0x0f172a@0.92:t=fill",
        "drawbox=x=245:y=310:w=150:h=28:color=0x0f172a@0.85:t=fill",
      ].join(","),
      "-frames:v",
      "1",
      outputPath,
    ],
    path.dirname(outputPath)
  );
};

const composeVideoWithFfmpeg = async (runDir: string): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      "background.png",
      "-loop",
      "1",
      "-i",
      "character.png",
      "-i",
      "audio.wav",
      "-filter_complex",
      "[0:v][1:v]overlay=x=W-w-80:y=H-h-20,ass=subtitles.ass",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "preview.mp4",
    ],
    runDir
  );
};

const tryRemotionRender = async ({
  workspaceRoot,
  outputPath,
  audioPath,
  backgroundImagePath,
  characterImagePath,
  subtitleTracks,
  title,
  theme,
  logger,
}: {
  workspaceRoot: string;
  outputPath: string;
  audioPath: string;
  backgroundImagePath: string;
  characterImagePath: string;
  subtitleTracks: ScriptTimestamp[];
  title: string;
  theme: string;
  logger: Logger;
}): Promise<boolean> => {
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
      audioPath: pathToFileURL(audioPath).toString(),
      backgroundImagePath: pathToFileURL(backgroundImagePath).toString(),
      characterImagePath: pathToFileURL(characterImagePath).toString(),
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
    return true;
  } catch (error) {
    logger.warn("Remotion rendering failed. Fallback to ffmpeg.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const reencodeYoutubeCompatible = async (
  inputPath: string,
  outputPath: string
): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
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
): Promise<void> =>
  new Promise((resolve, reject) => {
    const processRef = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    processRef.on("error", (error) => reject(error));
    processRef.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
