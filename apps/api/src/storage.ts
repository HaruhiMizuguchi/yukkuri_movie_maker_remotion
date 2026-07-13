import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  ScriptSchema,
  TimelineDataSchema,
  type Script,
  type TimelineData,
} from "@ymm/shared";
import {
  normalizeTemplateId,
  normalizeAssetId,
  prepareSettingsForStorage,
  type ApiSettings,
} from "./apiValidation";

export type AppSettings = ApiSettings;

export type ProjectTemplate = {
  id: string;
  name: string;
  description?: string;
  scriptSeed: Record<string, unknown>;
  timelinePreset: TimelineData;
  assets?: ProjectAsset[];
  outputPreset?: ApiSettings["outputPreset"];
  automationProfile?: {
    mode: "full" | "scriptOnly" | "renderOnly" | "custom";
    skipSteps?: string[];
  };
};

export type ProjectAsset = {
  id: string;
  type: "audio" | "subtitle" | "image" | "video" | "script" | "metadata";
  name: string;
  relativePath: string;
  usage?: "background" | "character" | "bgm" | "se" | "reference" | "other";
  createdAt: string;
};

export const readProjectScript = async (
  workspaceRoot: string,
  projectId: string,
): Promise<Script | null> => {
  const manualPath = getProjectManualScriptPath(workspaceRoot, projectId);
  if (await fileExists(manualPath)) {
    return ScriptSchema.parse(await readJson(manualPath));
  }
  const latestPath = getProjectScriptLatestPath(workspaceRoot, projectId);
  const exists = await fileExists(latestPath);
  if (!exists) {
    return null;
  }
  const json = await readJson(latestPath);
  return ScriptSchema.parse(json);
};

export const saveProjectScript = async (
  workspaceRoot: string,
  projectId: string,
  script: Script,
): Promise<void> => {
  const parsed = ScriptSchema.parse(script);
  const runId = `manual-${Date.now()}`;
  const runPath = getProjectScriptRunPath(workspaceRoot, projectId, runId);
  const latestPath = getProjectScriptLatestPath(workspaceRoot, projectId);
  const manualPath = getProjectManualScriptPath(workspaceRoot, projectId);
  await fs.mkdir(path.dirname(manualPath), { recursive: true });
  await writeJson(manualPath, parsed);
  await fs.mkdir(path.dirname(runPath), { recursive: true });
  await writeJson(runPath, parsed);
  await fs.mkdir(path.dirname(latestPath), { recursive: true });
  await writeJson(latestPath, parsed);
  await synchronizeTimelineWithScript(workspaceRoot, projectId, parsed);
};

export const synchronizeTimelineWithScript = async (
  workspaceRoot: string,
  projectId: string,
  script: Script,
): Promise<void> => {
  const timelinePath = getTimelinePath(workspaceRoot, projectId);
  const generated = createTimelineFromScript(script);
  if (!(await fileExists(timelinePath))) {
    await saveTimeline(workspaceRoot, projectId, generated);
    return;
  }
  const current = TimelineDataSchema.parse(await readJson(timelinePath));
  const generatedSubtitleTrack = generated.tracks.find(
    (track) => track.type === "subtitle",
  )!;
  const generatedAudioTrack = generated.tracks.find(
    (track) => track.type === "audio",
  )!;
  const totalDuration = generated.playbackRange.outMs;
  const tracks = current.tracks.map((track) => {
    if (track.type === "subtitle") {
      const manualClips = track.clips.filter(
        (clip) => !/^sub-\d+$/.test(clip.id),
      );
      return {
        ...track,
        clips: [...generatedSubtitleTrack.clips, ...manualClips],
      };
    }
    if (track.type === "audio" && track.id === "track-audio") {
      return { ...track, clips: generatedAudioTrack.clips };
    }
    return track;
  });
  const maxClipEnd = Math.max(
    totalDuration,
    ...tracks.flatMap((track) =>
      track.clips.map((clip) => clip.startMs + clip.durationMs),
    ),
  );
  await saveTimeline(workspaceRoot, projectId, {
    ...current,
    tracks,
    playbackRange: {
      inMs: Math.min(current.playbackRange.inMs, maxClipEnd - 1000),
      outMs: Math.max(current.playbackRange.outMs, maxClipEnd),
    },
  });
};

export const readOrCreateTimeline = async (
  workspaceRoot: string,
  projectId: string,
  script: Script,
): Promise<TimelineData> => {
  const timelinePath = getTimelinePath(workspaceRoot, projectId);
  const exists = await fileExists(timelinePath);
  if (exists) {
    return TimelineDataSchema.parse(await readJson(timelinePath));
  }

  const timeline = createTimelineFromScript(script);
  await saveTimeline(workspaceRoot, projectId, timeline);
  return timeline;
};

export const saveTimeline = async (
  workspaceRoot: string,
  projectId: string,
  timeline: TimelineData,
): Promise<void> => {
  const parsed = TimelineDataSchema.parse(timeline);
  const timelinePath = getTimelinePath(workspaceRoot, projectId);
  await fs.mkdir(path.dirname(timelinePath), { recursive: true });
  await writeJson(timelinePath, parsed);
};

export const readSettings = async (
  workspaceRoot: string,
): Promise<AppSettings> => {
  const settingsPath = getSettingsPath(workspaceRoot);
  if (!(await fileExists(settingsPath))) {
    return defaultSettings();
  }
  const loaded = (await readJson(settingsPath)) as Partial<AppSettings>;
  return {
    apiKeys: {},
    outputPreset: {
      width: loaded.outputPreset?.width ?? 1920,
      height: loaded.outputPreset?.height ?? 1080,
      fps: loaded.outputPreset?.fps ?? 30,
    },
  };
};

export const writeSettings = async (
  workspaceRoot: string,
  settings: AppSettings,
): Promise<void> => {
  const settingsPath = getSettingsPath(workspaceRoot);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await writeJson(settingsPath, prepareSettingsForStorage(settings));
};

export const createTemplate = async (
  workspaceRoot: string,
  template: ProjectTemplate,
): Promise<void> => {
  const templatePath = getTemplatePath(workspaceRoot, template.id);
  await fs.mkdir(path.dirname(templatePath), { recursive: true });
  await writeJson(templatePath, template);
};

export const packageTemplateAssets = async (
  workspaceRoot: string,
  templateId: string,
  assets: ProjectAsset[],
): Promise<ProjectAsset[]> => {
  const safeTemplateId = normalizeTemplateId(templateId);
  const targetDirectory = path.join(
    workspaceRoot,
    "outputs",
    "system",
    "template-assets",
    safeTemplateId,
  );
  await fs.mkdir(targetDirectory, { recursive: true });

  return Promise.all(
    assets.map(async (asset) => {
      const safeAssetId = normalizeAssetId(asset.id);
      const extension = path.extname(asset.relativePath).toLowerCase();
      const targetPath = path.join(
        targetDirectory,
        `${safeAssetId}${extension}`,
      );
      await fs.copyFile(
        path.resolve(workspaceRoot, asset.relativePath),
        targetPath,
      );
      return {
        ...asset,
        id: safeAssetId,
        relativePath: path
          .relative(workspaceRoot, targetPath)
          .replaceAll("\\", "/"),
      };
    }),
  );
};

export const listTemplates = async (
  workspaceRoot: string,
): Promise<ProjectTemplate[]> => {
  const templatesDir = getTemplatesDir(workspaceRoot);
  if (!(await fileExists(templatesDir))) {
    return [];
  }
  const entries = await fs.readdir(templatesDir);
  const templates = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(
        async (entry) =>
          readJson(path.join(templatesDir, entry)) as Promise<ProjectTemplate>,
      ),
  );
  return templates;
};

export const listProjectAssets = async (
  workspaceRoot: string,
  projectId: string,
): Promise<ProjectAsset[]> => {
  const assetsPath = getProjectAssetsPath(workspaceRoot, projectId);
  if (!(await fileExists(assetsPath))) {
    return [];
  }
  const loaded = (await readJson(assetsPath)) as ProjectAsset[];
  return loaded;
};

export const saveProjectAsset = async (
  workspaceRoot: string,
  projectId: string,
  asset: ProjectAsset,
): Promise<void> => {
  const assets = await listProjectAssets(workspaceRoot, projectId);
  const deduped = [
    ...assets.filter((existing) => existing.id !== asset.id),
    asset,
  ];
  const assetsPath = getProjectAssetsPath(workspaceRoot, projectId);
  await fs.mkdir(path.dirname(assetsPath), { recursive: true });
  await writeJson(assetsPath, deduped);
};

export const computeProjectInputRevision = async (
  workspaceRoot: string,
  projectId: string,
  settings: AppSettings,
): Promise<string> => {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(prepareSettingsForStorage(settings)));
  for (const directoryName of ["input", "intermediate"]) {
    const directoryPath = path.join(
      getProjectRoot(workspaceRoot, projectId),
      directoryName,
    );
    for (const filePath of await listFilesRecursively(directoryPath)) {
      hash.update(path.relative(directoryPath, filePath).replaceAll("\\", "/"));
      hash.update(await fs.readFile(filePath));
    }
  }
  return hash.digest("hex");
};

const createTimelineFromScript = (script: Script): TimelineData => {
  let cursor = 0;
  const subtitleClips = script.lines.map((line, index) => {
    const durationMs = Math.max(1200, line.text.length * 100);
    const clip = {
      id: `sub-${index + 1}`,
      assetType: "subtitle" as const,
      assetPath: "output/subtitle_generation/latest/subtitles.json",
      startMs: cursor,
      durationMs,
      text: line.text,
      style: line.speaker,
      timingMode: "generated" as const,
    };
    cursor += durationMs;
    return clip;
  });

  const totalDuration = Math.max(cursor, 5000);
  return {
    playbackRange: { inMs: 0, outMs: totalDuration },
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
            durationMs: totalDuration,
            inMs: 0,
            outMs: totalDuration,
            volume: 1,
            timingMode: "generated" as const,
          },
        ],
      },
      {
        id: "track-subtitle",
        name: "字幕",
        type: "subtitle",
        clips: subtitleClips,
      },
    ],
  };
};

const defaultSettings = (): AppSettings => ({
  apiKeys: {},
  outputPreset: { width: 1920, height: 1080, fps: 30 },
});

const getProjectRoot = (workspaceRoot: string, projectId: string): string =>
  path.join(workspaceRoot, "projects", projectId);

const getProjectScriptLatestPath = (
  workspaceRoot: string,
  projectId: string,
): string =>
  path.join(
    getProjectRoot(workspaceRoot, projectId),
    "output",
    "script_generation",
    "latest",
    "script.json",
  );

const getProjectScriptRunPath = (
  workspaceRoot: string,
  projectId: string,
  runId: string,
): string =>
  path.join(
    getProjectRoot(workspaceRoot, projectId),
    "output",
    "script_generation",
    runId,
    "script.json",
  );

const getProjectManualScriptPath = (
  workspaceRoot: string,
  projectId: string,
): string =>
  path.join(
    getProjectRoot(workspaceRoot, projectId),
    "input",
    "manual-script.json",
  );

const getTimelinePath = (workspaceRoot: string, projectId: string): string =>
  path.join(
    getProjectRoot(workspaceRoot, projectId),
    "intermediate",
    "timeline.json",
  );

const getProjectAssetsPath = (
  workspaceRoot: string,
  projectId: string,
): string =>
  path.join(
    getProjectRoot(workspaceRoot, projectId),
    "input",
    "assets",
    "assets.json",
  );

const getSettingsPath = (workspaceRoot: string): string =>
  path.join(workspaceRoot, "outputs", "system", "settings.json");

const getTemplatesDir = (workspaceRoot: string): string =>
  path.join(workspaceRoot, "outputs", "system", "templates");

const getTemplatePath = (workspaceRoot: string, templateId: string): string =>
  path.join(
    getTemplatesDir(workspaceRoot),
    `${normalizeTemplateId(templateId)}.json`,
  );

const readJson = async (targetPath: string): Promise<unknown> => {
  const text = await fs.readFile(targetPath, "utf-8");
  return JSON.parse(text);
};

const writeJson = async (targetPath: string, value: unknown): Promise<void> => {
  await fs.writeFile(
    targetPath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf-8",
  );
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const listFilesRecursively = async (
  directoryPath: string,
): Promise<string[]> => {
  if (!(await fileExists(directoryPath))) {
    return [];
  }
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      return entry.isDirectory()
        ? listFilesRecursively(entryPath)
        : [entryPath];
    }),
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
};
