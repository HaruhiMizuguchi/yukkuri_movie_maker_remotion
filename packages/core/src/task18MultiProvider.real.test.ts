import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createProductionWorkflowImplementations,
  type WorkflowContext,
} from "./index";

const openaiApiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";

const createContext = (
  outputRoot: string,
  projectId: string,
  theme: string,
): WorkflowContext =>
  ({
    jobId: `job-${projectId}`,
    outputRoot,
    prisma: {
      projectFile: {
        createMany: async ({ data }: { data: unknown[] }) => ({
          count: data.length,
        }),
      },
      job: {
        findUnique: async () => ({
          id: `job-${projectId}`,
          projectId,
          mode: "full",
          project: { id: projectId, theme },
        }),
      },
    },
  }) as unknown as WorkflowContext;

describe("task18 multi provider real generation", () => {
  it.skipIf(!openaiApiKey)(
    "OpenAIへ実接続し、台本・画像・使用量証跡を生成する（OPENAI_API_KEY未設定時はskip）",
    async () => {
      const runId = `openai-${Date.now()}`;
      const outputRoot = path.join(
        process.cwd(),
        "outputs",
        "test_evidence",
        "task18_ai_real",
        runId,
      );
      const projectId = `project-${runId}`;
      const context = createContext(
        outputRoot,
        projectId,
        "AIモデルを使い分ける実践的な方法",
      );
      const implementations = createProductionWorkflowImplementations({
        outputRoot,
        openaiApiKey,
        scriptModel: "gpt-5.6-luna",
        imageModel: "gpt-image-2",
        cacheEnabled: false,
        retryCount: 0,
      });

      const scriptOutput = await implementations.script_generation?.(context);
      expect(scriptOutput).toMatchObject({
        generationSource: "api",
        generationProvider: "openai",
        aiUsage: {
          provider: "openai",
          kind: "llm",
          model: "gpt-5.6-luna",
        },
      });

      const imageOutput =
        await implementations.background_generation?.(context);
      expect(imageOutput).toMatchObject({
        generationSource: "openai-api",
        aiUsage: {
          provider: "openai",
          kind: "image",
          model: "gpt-image-2",
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
          { runId, scriptPath, imagePath, scriptOutput, imageOutput },
          null,
          2,
        ) + "\n",
        "utf-8",
      );
    },
    300_000,
  );

  it.skipIf(!anthropicApiKey)(
    "Claudeへ実接続し、台本・使用量証跡を生成する（ANTHROPIC_API_KEY未設定時はskip）",
    async () => {
      const runId = `anthropic-${Date.now()}`;
      const outputRoot = path.join(
        process.cwd(),
        "outputs",
        "test_evidence",
        "task18_ai_real",
        runId,
      );
      const projectId = `project-${runId}`;
      const context = createContext(
        outputRoot,
        projectId,
        "生成AIの安全な使い分け",
      );
      const implementations = createProductionWorkflowImplementations({
        outputRoot,
        anthropicApiKey,
        scriptModel: "claude-haiku-4-5",
        cacheEnabled: false,
        retryCount: 0,
      });

      const scriptOutput = await implementations.script_generation?.(context);
      expect(scriptOutput).toMatchObject({
        generationSource: "api",
        generationProvider: "anthropic",
        aiUsage: {
          provider: "anthropic",
          kind: "llm",
          model: "claude-haiku-4-5",
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
      expect((await fs.stat(scriptPath)).size).toBeGreaterThan(100);
      await fs.writeFile(
        path.join(outputRoot, "verification.json"),
        JSON.stringify({ runId, scriptPath, scriptOutput }, null, 2) + "\n",
        "utf-8",
      );
    },
    300_000,
  );
});
