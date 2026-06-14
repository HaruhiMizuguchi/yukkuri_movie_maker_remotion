import path from "node:path";
import { WORKFLOW_STEPS, type WorkflowStepName } from "@ymm/core";
import { z } from "zod";

const workflowStepSchema = z.enum(
  [...WORKFLOW_STEPS] as [WorkflowStepName, ...WorkflowStepName[]]
);

export const createJobBodySchema = z.object({
  mode: z.string().default("full"),
  runMode: z.enum(["full", "resume"]).optional(),
  skipSteps: z.array(workflowStepSchema).optional(),
});

export const settingsBodySchema = z.object({
  apiKeys: z
    .object({
      google: z.string().optional(),
      openai: z.string().optional(),
      stability: z.string().optional(),
    })
    .default({}),
  outputPreset: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
  }),
});

export type ApiSettings = z.infer<typeof settingsBodySchema>;

export const parseCreateJobBody = (input: unknown): z.infer<typeof createJobBodySchema> =>
  createJobBodySchema.parse(input ?? {});

export const buildSafeAssetFilename = (assetId: string, extension: string): string => {
  const safeAssetId = normalizeAssetId(assetId);
  const normalizedExtension = extension.startsWith(".") ? extension.slice(1) : extension;
  const safeExtension = parseSafePathToken(normalizedExtension, "asset extension");
  return `${safeAssetId}.${safeExtension}`;
};

export const normalizeAssetId = (assetId: string): string =>
  parseSafePathToken(assetId, "asset id");

export const normalizeProjectRelativePath = (relativePath: string): string => {
  const normalized = relativePath.replaceAll("\\", "/").trim();
  if (!normalized || path.isAbsolute(normalized) || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error("Project relative path must be relative.");
  }

  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    throw new Error("Project relative path contains an unsafe segment.");
  }

  return segments.join("/");
};

export const prepareSettingsForStorage = (settings: ApiSettings): ApiSettings => ({
  apiKeys: {},
  outputPreset: settings.outputPreset,
});

export const canAccessProject = (
  ownerId: string | null,
  requestUserId: string | null
): boolean => {
  if (!requestUserId || !ownerId) {
    return true;
  }
  return ownerId === requestUserId;
};

const parseSafePathToken = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(trimmed)) {
    throw new Error(`Invalid ${label}.`);
  }
  return trimmed;
};
