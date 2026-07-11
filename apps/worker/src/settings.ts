import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const outputPresetSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
});

const workerSettingsSchema = z.object({
  outputPreset: outputPresetSchema.default({ width: 1920, height: 1080, fps: 30 }),
});

export type WorkerSettings = z.infer<typeof workerSettingsSchema>;

export const readWorkerSettings = async (workspaceRoot: string): Promise<WorkerSettings> => {
  const settingsPath = path.join(workspaceRoot, "outputs", "system", "settings.json");
  try {
    const loaded = JSON.parse(await fs.readFile(settingsPath, "utf-8")) as unknown;
    return workerSettingsSchema.parse(loaded);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return workerSettingsSchema.parse({});
    }
    throw error;
  }
};
