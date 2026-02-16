import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Script } from "@ymm/shared";

type AivisSpeaker = {
  name: string;
  styles?: Array<{ id: number; name: string; type?: string }>;
};

type AivisStyleCatalogItem = {
  styleId: number;
  styleName: string;
  speakerName: string;
};

export type Task3TtsProvider = "aivis" | "mock";

export type ScriptTimestamp = {
  index: number;
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type Task3TtsResult = {
  provider: Task3TtsProvider;
  timestamps: ScriptTimestamp[];
  usedStyleIds: number[];
};

export type Task3VisualAssetsResult = {
  backgroundRenderPath: string;
  characterRenderPath: string;
  backgroundSourceRelativePath: string;
  characterSourceRelativePath: string;
};

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export const synthesizeTask3Speech = async ({
  script,
  runDir,
  audioPath,
  provider,
  fetchFn,
  aivisBaseUrl,
  allowMockFallback,
}: {
  script: Script;
  runDir: string;
  audioPath: string;
  provider: Task3TtsProvider;
  fetchFn: typeof fetch;
  aivisBaseUrl?: string;
  allowMockFallback: boolean;
}): Promise<Task3TtsResult> => {
  if (provider === "mock") {
    return synthesizeByMock(script, runDir, audioPath);
  }

  try {
    return await synthesizeByAivis({
      script,
      runDir,
      audioPath,
      fetchFn,
      aivisBaseUrl,
    });
  } catch (error) {
    if (!allowMockFallback) {
      throw error;
    }
    return synthesizeByMock(script, runDir, audioPath);
  }
};

export const prepareTask3VisualAssets = async ({
  projectRoot,
  workspaceRoot,
  outputRoot,
  runDir,
  requireCharacterAsset,
}: {
  projectRoot: string;
  workspaceRoot: string;
  outputRoot: string;
  runDir: string;
  requireCharacterAsset: boolean;
}): Promise<Task3VisualAssetsResult> => {
  const backgroundRenderPath = path.join(runDir, "background.png");
  const characterRenderPath = path.join(runDir, "character.png");

  const backgroundSourcePath =
    (await findFirstImage(path.join(projectRoot, "input", "assets", "backgrounds"))) ??
    (await findNamedImage(path.join(projectRoot, "input", "assets"), ["background", "bg"])) ??
    (await findFirstImage(path.join(workspaceRoot, "assets", "backgrounds")));
  if (backgroundSourcePath) {
    await fs.copyFile(backgroundSourcePath, backgroundRenderPath);
  } else {
    await createFallbackBackground(backgroundRenderPath);
  }

  const characterSourcePath =
    (await findFirstImage(path.join(projectRoot, "input", "assets", "characters"))) ??
    (await findNamedImage(path.join(projectRoot, "input", "assets"), [
      "character",
      "standing",
    ])) ??
    (await findFirstImage(path.join(workspaceRoot, "assets", "characters")));
  if (characterSourcePath) {
    await fs.copyFile(characterSourcePath, characterRenderPath);
  } else {
    if (requireCharacterAsset) {
      throw new Error("Character image asset is required, but was not found.");
    }
    // 本番素材が無い開発環境向けに、最低限の立ち絵を生成する。
    await createFallbackCharacter(characterRenderPath);
  }

  return {
    backgroundRenderPath,
    characterRenderPath,
    backgroundSourceRelativePath: toRelativePath(
      outputRoot,
      backgroundSourcePath ?? backgroundRenderPath
    ),
    characterSourceRelativePath: toRelativePath(
      outputRoot,
      characterSourcePath ?? characterRenderPath
    ),
  };
};

const synthesizeByMock = async (
  script: Script,
  runDir: string,
  audioPath: string
): Promise<Task3TtsResult> => {
  const clipsDir = path.join(runDir, "clips");
  await fs.mkdir(clipsDir, { recursive: true });

  const timestamps: ScriptTimestamp[] = [];
  const clipPaths: string[] = [];
  let cursorMs = 0;

  for (let index = 0; index < script.lines.length; index += 1) {
    const line = script.lines[index];
    const durationSec = Math.max(0.9, line.text.length * 0.09);
    const durationMs = Math.round(durationSec * 1000);
    const frequency = line.speaker.toLowerCase().includes("marisa") ? 510 : 410;
    const clipPath = path.join(clipsDir, `line-${String(index + 1).padStart(3, "0")}.wav`);

    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${frequency}:sample_rate=24000:duration=${durationSec.toFixed(3)}`,
        "-c:a",
        "pcm_s16le",
        clipPath,
      ],
      runDir
    );

    timestamps.push({
      index,
      speaker: line.speaker,
      text: line.text,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
    });
    cursorMs += durationMs;
    clipPaths.push(clipPath);
  }

  await concatAudioClips(clipPaths, audioPath, runDir);
  return {
    provider: "mock",
    timestamps,
    usedStyleIds: [],
  };
};

const synthesizeByAivis = async ({
  script,
  runDir,
  audioPath,
  fetchFn,
  aivisBaseUrl,
}: {
  script: Script;
  runDir: string;
  audioPath: string;
  fetchFn: typeof fetch;
  aivisBaseUrl?: string;
}): Promise<Task3TtsResult> => {
  if (!aivisBaseUrl || aivisBaseUrl.trim().length === 0) {
    throw new Error("AIVIS_SPEECH_BASE_URL is missing.");
  }

  const baseUrl = aivisBaseUrl.replace(/\/$/, "");
  const speakers = (await fetchJson(fetchFn, `${baseUrl}/speakers`)) as AivisSpeaker[];
  if (!Array.isArray(speakers) || speakers.length === 0) {
    throw new Error("Aivis speakers are unavailable.");
  }

  const styleCatalog = speakers.flatMap((speaker) =>
    (speaker.styles ?? []).map((style) => ({
      styleId: style.id,
      styleName: style.name,
      speakerName: speaker.name,
    }))
  );
  if (styleCatalog.length === 0) {
    throw new Error("Aivis styles are unavailable.");
  }

  const clipsDir = path.join(runDir, "clips");
  await fs.mkdir(clipsDir, { recursive: true });

  const timestamps: ScriptTimestamp[] = [];
  const clipPaths: string[] = [];
  const usedStyleIds: number[] = [];
  let cursorMs = 0;

  for (let index = 0; index < script.lines.length; index += 1) {
    const line = script.lines[index];
    const styleId = selectAivisStyleId(styleCatalog, line.speaker, index);
    const query = (await fetchJson(
      fetchFn,
      `${baseUrl}/audio_query?speaker=${styleId}&text=${encodeURIComponent(line.text)}`,
      { method: "POST" }
    )) as Record<string, unknown>;

    const normalizedQuery: Record<string, unknown> = {
      ...query,
      speedScale: line.speaker.toLowerCase().includes("marisa") ? 1.06 : 1,
      intonationScale: 1,
      volumeScale: 1,
    };

    const binary = await fetchBinary(fetchFn, `${baseUrl}/synthesis?speaker=${styleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedQuery),
    });
    const clipPath = path.join(clipsDir, `line-${String(index + 1).padStart(3, "0")}.wav`);
    await fs.writeFile(clipPath, binary);

    const durationMs = await probeAudioDurationMs(clipPath);
    timestamps.push({
      index,
      speaker: line.speaker,
      text: line.text,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
    });
    cursorMs += durationMs;
    clipPaths.push(clipPath);
    usedStyleIds.push(styleId);
  }

  await concatAudioClips(clipPaths, audioPath, runDir);
  return {
    provider: "aivis",
    timestamps,
    usedStyleIds,
  };
};

const selectAivisStyleId = (
  catalog: AivisStyleCatalogItem[],
  speakerName: string,
  index: number
): number => {
  const normalized = speakerName.toLowerCase();
  const envStyleId = normalized.includes("marisa")
    ? parseStyleId(process.env.AIVIS_STYLE_ID_MARISA)
    : normalized.includes("reimu")
      ? parseStyleId(process.env.AIVIS_STYLE_ID_REIMU)
      : null;
  if (envStyleId && catalog.some((item) => item.styleId === envStyleId)) {
    return envStyleId;
  }

  const isMarisa = normalized.includes("marisa") || speakerName.includes("魔理沙");
  const isReimu = normalized.includes("reimu") || speakerName.includes("霊夢");
  const preferredStyles = isMarisa
    ? ["テンション高め", "上機嫌", "通常", "ノーマル"]
    : isReimu
      ? ["ノーマル", "通常", "落ち着き"]
      : [];

  for (const preferred of preferredStyles) {
    const matched = catalog.find((item) => item.styleName.includes(preferred));
    if (matched) {
      return matched.styleId;
    }
  }

  return catalog[index % catalog.length].styleId;
};

const parseStyleId = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const concatAudioClips = async (
  clipPaths: string[],
  outputPath: string,
  runDir: string
): Promise<void> => {
  const concatPath = path.join(runDir, "clips", "concat.txt");
  const text = clipPaths
    .map((clipPath) => `file '${clipPath.replaceAll("\\", "/")}'`)
    .join("\n");
  await fs.writeFile(concatPath, `${text}\n`, "utf-8");

  try {
    await runCommand(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", outputPath],
      runDir
    );
  } catch {
    await runCommand(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-ar",
        "24000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        outputPath,
      ],
      runDir
    );
  }
};

const probeAudioDurationMs = async (audioPath: string): Promise<number> => {
  const output = await runCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      audioPath,
    ],
    path.dirname(audioPath)
  );
  const durationSec = Number(output.trim());
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(durationSec * 1000));
};

const fetchJson = async (
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit
): Promise<unknown> => {
  const response = await fetchFn(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
};

const fetchBinary = async (
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit
): Promise<Buffer> => {
  const response = await fetchFn(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const findFirstImage = async (directoryPath: string): Promise<string | null> => {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const nested = await findFirstImage(fullPath);
        if (nested) {
          return nested;
        }
        continue;
      }
      if (entry.isFile() && isImagePath(fullPath)) {
        return fullPath;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const findNamedImage = async (
  directoryPath: string,
  preferredNames: string[]
): Promise<string | null> => {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const fullPath = path.join(directoryPath, entry.name);
      if (!isImagePath(fullPath)) {
        continue;
      }
      const fileName = entry.name.toLowerCase();
      if (preferredNames.some((name) => fileName.includes(name))) {
        return fullPath;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const isImagePath = (filePath: string): boolean =>
  SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());

const createFallbackBackground = async (outputPath: string): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x1f2937:s=1920x1080:d=1",
      "-vf",
      "drawbox=x=0:y=0:w=1920:h=360:color=0x0ea5e9@0.34:t=fill,drawbox=x=0:y=360:w=1920:h=720:color=0x3b82f6@0.18:t=fill",
      "-frames:v",
      "1",
      outputPath,
    ],
    path.dirname(outputPath)
  );
};

const createFallbackCharacter = async (outputPath: string): Promise<void> => {
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black@0.0:s=640x900:d=1",
      "-vf",
      "drawbox=x=110:y=50:w=420:h=800:color=0xfef08a@0.96:t=fill,drawbox=x=180:y=140:w=80:h=80:color=0x0f172a@0.94:t=fill,drawbox=x=370:y=140:w=80:h=80:color=0x0f172a@0.94:t=fill,drawbox=x=220:y=300:w=200:h=26:color=0x0f172a@0.88:t=fill,drawbox=x=140:y=430:w=360:h=340:color=0xfb7185@0.18:t=fill",
      "-frames:v",
      "1",
      outputPath,
    ],
    path.dirname(outputPath)
  );
};

const toRelativePath = (outputRoot: string, absolutePath: string): string =>
  path.relative(outputRoot, absolutePath).replaceAll("\\", "/");

const runCommand = async (
  command: string,
  args: string[],
  cwd: string
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
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
