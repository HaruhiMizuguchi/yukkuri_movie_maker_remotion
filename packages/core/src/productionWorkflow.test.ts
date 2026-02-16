import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  createProductionWorkflowImplementations,
  runWorkflow,
  type WorkflowContext,
} from "./index";

const createPrismaMock = (projectId: string, theme: string) => {
  const updates: Array<any> = [];
  const prisma: any = {
    workflowStep: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockImplementation(async (payload) => {
        updates.push(payload);
        return payload;
      }),
    },
    projectFile: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-advanced",
        projectId,
        mode: "full",
        project: { id: projectId, theme },
      }),
    },
  };

  return { prisma, updates };
};

describe("production workflow implementations", () => {
  it("AI拡張ステップと運用機能を含む成果物を生成できる", async () => {
    const runId = `run-${Date.now()}`;
    const projectId = `project-${Date.now()}`;
    const outputRoot = path.join(process.cwd(), "outputs", "test_evidence", "task6", runId);
    const { prisma, updates } = createPrismaMock(projectId, "宇宙開発");

    const ctx = {
      jobId: "job-advanced",
      prisma,
      outputRoot,
    } as WorkflowContext;

    const implementations = createProductionWorkflowImplementations({
      outputRoot,
      disableRemotion: true,
      retryCount: 2,
      ttsProvider: "mock",
    });

    await runWorkflow(ctx, implementations, { mode: "full" });
    await runWorkflow(ctx, implementations, { mode: "full" });

    const base = path.join(outputRoot, "projects", projectId, "output");
    await expect(fs.stat(path.join(base, "theme_selection", "latest", "theme.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(base, "title_generation", "latest", "title.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(base, "background_generation", "latest", "background.png"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(base, "character_synthesis", "latest", "character_motion.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(base, "illustration_insertion", "latest", "illustration.png"))).resolves.toBeTruthy();

    const logPath = path.join(outputRoot, "projects", projectId, "logs", "workflow.log");
    const logText = await fs.readFile(logPath, "utf-8");
    expect(logText).toContain("cache_hit");

    const cachedOutput = updates.find((payload) => payload.data?.outputJson?.cached === true);
    expect(cachedOutput).toBeTruthy();
  }, 120000);
});
