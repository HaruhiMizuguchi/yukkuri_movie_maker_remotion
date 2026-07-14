import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createProductionWorkflowImplementations,
  type WorkflowContext,
} from "./index";

const googleApiKey = process.env.GOOGLE_API_KEY?.trim() ?? "";

const createPrismaMock = (projectId: string) => {
  const prisma: any = {
    projectFile: {
      createMany: async ({ data }: { data: unknown[] }) => ({
        count: data.length,
      }),
    },
    job: {
      findUnique: async () => ({
        id: "job-task17-ai-real",
        projectId,
        mode: "full",
        project: {
          id: projectId,
          theme: "生成AIを安全に使う3つのポイント",
        },
      }),
    },
  };
  return prisma;
};

describe("task17 AI real generation", () => {
  it.skipIf(!googleApiKey)(
    "選択モデルへ実接続し、台本・画像・使用量証跡を生成する（APIキー未設定時はskip）",
    async () => {
      const runId = `run-${Date.now()}`;
      const outputRoot = path.join(
        process.cwd(),
        "outputs",
        "test_evidence",
        "task17_ai_real",
        runId,
      );
      const projectId = `project-${Date.now()}`;
      const ctx = {
        jobId: "job-task17-ai-real",
        prisma: createPrismaMock(projectId),
        outputRoot,
      } as WorkflowContext;
      const implementations = createProductionWorkflowImplementations({
        outputRoot,
        googleApiKey,
        scriptModel: "gemini-3.1-flash-lite",
        imageModel: "gemini-3.1-flash-lite-image",
        cacheEnabled: false,
        retryCount: 0,
      });

      const scriptOutput = await implementations.script_generation?.(ctx);
      expect(scriptOutput).toMatchObject({
        generationSource: "api",
        aiUsage: {
          kind: "llm",
          model: "gemini-3.1-flash-lite",
        },
      });

      const imageOutput = await implementations.background_generation?.(ctx);
      expect(imageOutput).toMatchObject({
        generationSource: "google-api",
        aiUsage: {
          kind: "image",
          model: "gemini-3.1-flash-lite-image",
          imageCount: 1,
        },
      });

      const scriptPath = path.join(
        outputRoot,
        "projects",
        projectId,
        "output",
        "script_generation",
        "latest",
        "script.json",
      );
      const imagePath = path.join(
        outputRoot,
        "projects",
        projectId,
        "output",
        "background_generation",
        "latest",
        "background.png",
      );
      const [scriptStat, imageStat] = await Promise.all([
        fs.stat(scriptPath),
        fs.stat(imagePath),
      ]);
      expect(scriptStat.size).toBeGreaterThan(100);
      expect(imageStat.size).toBeGreaterThan(1_000);

      await fs.writeFile(
        path.join(outputRoot, "verification.json"),
        JSON.stringify(
          {
            runId,
            scriptPath,
            imagePath,
            scriptOutput,
            imageOutput,
          },
          null,
          2,
        ) + "\n",
        "utf-8",
      );
    },
    300_000,
  );
});
