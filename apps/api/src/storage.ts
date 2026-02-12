import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ScriptSchema,
  TimelineDataSchema,
  type Script,
  type TimelineData,
} from "@ymm/shared";

export type AppSettings = {
  apiKeys: {
    google?: string;
    openai?: string;
    stability?: string;
  };
  outputPreset: {
    width: number;
    height: number;
    fps: number;
  };
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description?: string;
  scriptSeed: Record<string, unknown>;
  timelinePreset: TimelineData;
};

export type ProjectAsset = {
  id: string;
  type: "audio" | "subtitle" | "image" | "video" | "script" | "metadata";
  name: string;
  relativePath: string;
  createdAt: string;
};

export const readProjectScript = async (
  workspaceRoot: string,
  projectId: string
): Promise<Script | null> => {
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
  script: Script
): Promise<void> => {
  const parsed = ScriptSchema.parse(script);
  const runId = `manual-${Date.now()}`;
  const runPath = getProjectScriptRunPath(workspaceRoot, projectId, runId);
  const latestPath = getProjectScriptLatestPath(workspaceRoot, projectId);
  await fs.mkdir(path.dirname(runPath), { recursive: true });
  await writeJson(runPath, parsed);
  await fs.mkdir(path.dirname(latestPath), { recursive: true });
  await writeJson(latestPath, parsed);
};

export const readOrCreateTimeline = async (
  workspaceRoot: string,
  projectId: string,
  script: Script
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
  timeline: TimelineData
): Promise<void> => {
  const parsed = TimelineDataSchema.parse(timeline);
  const timelinePath = getTimelinePath(workspaceRoot, projectId);
  await fs.mkdir(path.dirname(timelinePath), { recursive: true });
  await writeJson(timelinePath, parsed);
};

export const readSettings = async (workspaceRoot: string): Promise<AppSettings> => {
  const settingsPath = getSettingsPath(workspaceRoot);
  if (!(await fileExists(settingsPath))) {
    return defaultSettings();
  }
  const loaded = (await readJson(settingsPath)) as Partial<AppSettings>;
  return {
    apiKeys: loaded.apiKeys ?? {},
    outputPreset: {
      width: loaded.outputPreset?.width ?? 1920,
      height: loaded.outputPreset?.height ?? 1080,
      fps: loaded.outputPreset?.fps ?? 30,
    },
  };
};

export const writeSettings = async (
  workspaceRoot: string,
  settings: AppSettings
): Promise<void> => {
  const settingsPath = getSettingsPath(workspaceRoot);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await writeJson(settingsPath, settings);
};

export const createTemplate = async (
  workspaceRoot: string,
  template: ProjectTemplate
): Promise<void> => {
  const templatePath = getTemplatePath(workspaceRoot, template.id);
  await fs.mkdir(path.dirname(templatePath), { recursive: true });
  await writeJson(templatePath, template);
};

export const listTemplates = async (workspaceRoot: string): Promise<ProjectTemplate[]> => {
  const templatesDir = getTemplatesDir(workspaceRoot);
  if (!(await fileExists(templatesDir))) {
    return [];
  }
  const entries = await fs.readdir(templatesDir);
  const templates = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry) => readJson(path.join(templatesDir, entry)) as Promise<ProjectTemplate>)
  );
  return templates;
};

export const listProjectAssets = async (
  workspaceRoot: string,
  projectId: string
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
  asset: ProjectAsset
): Promise<void> => {
  const assets = await listProjectAssets(workspaceRoot, projectId);
  const deduped = [...assets.filter((existing) => existing.id !== asset.id), asset];
  const assetsPath = getProjectAssetsPath(workspaceRoot, projectId);
  await fs.mkdir(path.dirname(assetsPath), { recursive: true });
  await writeJson(assetsPath, deduped);
};

export const saveProjectOwner = async (
  workspaceRoot: string,
  projectId: string,
  ownerId: string
): Promise<void> => {
  const ownerPath = getProjectOwnerPath(workspaceRoot, projectId);
  await fs.mkdir(path.dirname(ownerPath), { recursive: true });
  await writeJson(ownerPath, { ownerId });
};

export const readProjectOwner = async (
  workspaceRoot: string,
  projectId: string
): Promise<string | null> => {
  const ownerPath = getProjectOwnerPath(workspaceRoot, projectId);
  if (!(await fileExists(ownerPath))) {
    return null;
  }
  const loaded = (await readJson(ownerPath)) as { ownerId?: string };
  return loaded.ownerId ?? null;
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

const getProjectScriptLatestPath = (workspaceRoot: string, projectId: string): string =>
  path.join(getProjectRoot(workspaceRoot, projectId), "output", "script_generation", "latest", "script.json");

const getProjectScriptRunPath = (
  workspaceRoot: string,
  projectId: string,
  runId: string
): string =>
  path.join(
    getProjectRoot(workspaceRoot, projectId),
    "output",
    "script_generation",
    runId,
    "script.json"
  );

const getTimelinePath = (workspaceRoot: string, projectId: string): string =>
  path.join(getProjectRoot(workspaceRoot, projectId), "intermediate", "timeline.json");

const getProjectAssetsPath = (workspaceRoot: string, projectId: string): string =>
  path.join(getProjectRoot(workspaceRoot, projectId), "input", "assets", "assets.json");

const getProjectOwnerPath = (workspaceRoot: string, projectId: string): string =>
  path.join(getProjectRoot(workspaceRoot, projectId), "input", "project_owner.json");

const getSettingsPath = (workspaceRoot: string): string =>
  path.join(workspaceRoot, "outputs", "system", "settings.json");

const getTemplatesDir = (workspaceRoot: string): string =>
  path.join(workspaceRoot, "outputs", "system", "templates");

const getTemplatePath = (workspaceRoot: string, templateId: string): string =>
  path.join(getTemplatesDir(workspaceRoot), `${templateId}.json`);

const readJson = async (targetPath: string): Promise<unknown> => {
  const text = await fs.readFile(targetPath, "utf-8");
  return JSON.parse(text);
};

const writeJson = async (targetPath: string, value: unknown): Promise<void> => {
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
};
