import path from "node:path";
import {
  AutomationModeSchema,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SCRIPT_MODEL,
  ImageGenerationModelSchema,
  ScriptGenerationModelSchema,
  WorkflowStepNameSchema,
  type WorkflowStepName,
} from "@ymm/shared";
import { z } from "zod";

const workflowStepSchema = WorkflowStepNameSchema;
const workflowModeSchema = AutomationModeSchema;

export const createJobBodySchema = z.object({
  mode: workflowModeSchema.default("full"),
  runMode: z.enum(["full", "resume"]).optional(),
  skipSteps: z.array(workflowStepSchema).optional(),
  forceSteps: z.array(workflowStepSchema).optional(),
});

export const settingsBodySchema = z.object({
  models: z
    .object({
      script: ScriptGenerationModelSchema,
      image: ImageGenerationModelSchema,
    })
    .default({
      script: DEFAULT_SCRIPT_MODEL,
      image: DEFAULT_IMAGE_MODEL,
    }),
  outputPreset: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
  }),
});

export type ApiSettings = z.infer<typeof settingsBodySchema>;
export type CreateJobBody = z.infer<typeof createJobBodySchema>;

export const parseCreateJobBody = (
  input: unknown,
): z.infer<typeof createJobBodySchema> =>
  createJobBodySchema.parse(input ?? {});

const modeSkipSteps: Record<CreateJobBody["mode"], WorkflowStepName[]> = {
  full: [],
  scriptOnly: [
    "tts_generation",
    "audio_enhancement",
    "character_synthesis",
    "background_generation",
    "background_animation",
    "illustration_insertion",
    "subtitle_generation",
    "video_composition",
    "final_encoding",
    "youtube_upload",
  ],
  renderOnly: [
    "theme_selection",
    "script_generation",
    "title_generation",
    "youtube_upload",
  ],
  custom: [],
};

export const resolveWorkflowJobRequest = (
  input: unknown,
): {
  mode: CreateJobBody["mode"];
  runMode: CreateJobBody["runMode"];
  skipSteps?: WorkflowStepName[];
  forceSteps?: WorkflowStepName[];
} => {
  const parsed = parseCreateJobBody(input);
  const skipSteps = [
    ...new Set([...modeSkipSteps[parsed.mode], ...(parsed.skipSteps ?? [])]),
  ];
  return {
    mode: parsed.mode,
    runMode: parsed.runMode,
    skipSteps: skipSteps.length > 0 ? skipSteps : undefined,
    ...(parsed.forceSteps?.length
      ? { forceSteps: [...new Set(parsed.forceSteps)] }
      : {}),
  };
};

export const buildSafeAssetFilename = (
  assetId: string,
  extension: string,
): string => {
  const safeAssetId = normalizeAssetId(assetId);
  const normalizedExtension = extension.startsWith(".")
    ? extension.slice(1)
    : extension;
  const safeExtension = parseSafePathToken(
    normalizedExtension,
    "asset extension",
  );
  return `${safeAssetId}.${safeExtension}`;
};

export const normalizeAssetId = (assetId: string): string =>
  parseSafePathToken(assetId, "asset id");

export const normalizeTemplateId = (templateId: string): string =>
  parseSafePathToken(templateId, "template id");

export const normalizeProjectRelativePath = (relativePath: string): string => {
  const normalized = relativePath.replaceAll("\\", "/").trim();
  if (
    !normalized ||
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:\//.test(normalized)
  ) {
    throw new Error("Project relative path must be relative.");
  }

  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new Error("Project relative path contains an unsafe segment.");
  }

  return segments.join("/");
};

export const resolveSafeChildPath = (
  rootPath: string,
  relativePath: string,
): string => {
  const normalized = normalizeProjectRelativePath(relativePath);
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, normalized);
  const relativeFromRoot = path.relative(resolvedRoot, resolvedTarget);
  if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    throw new Error("Resolved path escapes root.");
  }
  return resolvedTarget;
};

export const normalizeAssetRelativePath = (
  projectId: string,
  relativePath: string,
): string => {
  const normalized = normalizeProjectRelativePath(relativePath);
  const projectAssetPrefix = `projects/${projectId}/input/assets/`;
  const sharedAssetPrefix = "assets/shared/";
  if (normalized.startsWith("input/assets/")) {
    return `projects/${projectId}/${normalized}`;
  }
  if (
    !normalized.startsWith(projectAssetPrefix) &&
    !normalized.startsWith(sharedAssetPrefix)
  ) {
    throw new Error(
      "Asset path must stay inside the project or shared asset directory.",
    );
  }
  return normalized;
};

export const prepareSettingsForStorage = (
  settings: ApiSettings,
): ApiSettings => ({
  models: settings.models,
  outputPreset: settings.outputPreset,
});

export const canAccessProject = (
  ownerId: string | null,
  requestUserId: string | null,
): boolean => {
  return Boolean(ownerId && requestUserId && ownerId === requestUserId);
};

export const readByteRange = (
  rangeHeader: string | undefined,
  fileSize: number,
): { start: number; end: number } | "invalid" | null => {
  if (!rangeHeader) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2]) || fileSize <= 0) {
    return "invalid";
  }
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, fileSize - Number(match[2]));
  const end = match[2] && match[1] ? Number(match[2]) : fileSize - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    start >= fileSize
  ) {
    return "invalid";
  }
  return { start, end: Math.min(end, fileSize - 1) };
};

const parseSafePathToken = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(trimmed)) {
    throw new Error(`Invalid ${label}.`);
  }
  return trimmed;
};
