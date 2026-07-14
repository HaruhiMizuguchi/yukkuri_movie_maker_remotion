import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SCRIPT_MODEL,
  ImageGenerationModelSchema,
  ScriptGenerationModelSchema,
} from "@ymm/shared";

const outputPresetSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
});

const workerSettingsSchema = z.object({
  models: z
    .object({
      script: ScriptGenerationModelSchema,
      image: ImageGenerationModelSchema,
    })
    .default({
      script: DEFAULT_SCRIPT_MODEL,
      image: DEFAULT_IMAGE_MODEL,
    }),
  outputPreset: outputPresetSchema.default({
    width: 1920,
    height: 1080,
    fps: 30,
  }),
});

export type WorkerSettings = z.infer<typeof workerSettingsSchema>;

const workerSecretSchema = z.object({
  googleApiKey: z.string().min(1).optional(),
});

export const readWorkerSettings = async (
  workspaceRoot: string,
  jobSettings?: unknown,
): Promise<WorkerSettings> => {
  const parsedJobSettings = workerSettingsSchema.safeParse(jobSettings);
  if (parsedJobSettings.success) {
    return parsedJobSettings.data;
  }
  const settingsPath = path.join(
    workspaceRoot,
    "outputs",
    "system",
    "settings.json",
  );
  try {
    const loaded = JSON.parse(
      await fs.readFile(settingsPath, "utf-8"),
    ) as unknown;
    return workerSettingsSchema.parse(loaded);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return workerSettingsSchema.parse({});
    }
    throw error;
  }
};

export const readWorkerGoogleApiKey = async (
  workspaceRoot: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<string | undefined> => {
  const secretsPath = path.join(
    workspaceRoot,
    "outputs",
    "system",
    "secrets.json",
  );
  try {
    const loaded = workerSecretSchema.parse(
      JSON.parse(await fs.readFile(secretsPath, "utf-8")),
    );
    return loaded.googleApiKey?.trim() || env.GOOGLE_API_KEY?.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return env.GOOGLE_API_KEY?.trim();
    }
    throw error;
  }
};
