import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  createDefaultWorkflowImplementations,
  runWorkflow,
  type WorkflowContext,
} from "./index";

const createPrismaMock = (projectId: string, theme: string) => {
  const updates: Array<any> = [];
  const upserts: Array<any> = [];
  const registeredFiles: Array<any> = [];

  const prisma: any = {
    workflowStep: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockImplementation(async (payload) => {
        upserts.push(payload);
        return payload;
      }),
      update: vi.fn().mockImplementation(async (payload) => {
        updates.push(payload);
        return payload;
      }),
    },
    projectFile: {
      createMany: vi.fn().mockImplementation(async ({ data }) => {
        registeredFiles.push(...data);
        return { count: data.length };
      }),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-integration",
        projectId,
        mode: "full",
        project: { id: projectId, theme },
      }),
    },
  };

  return { prisma, updates, upserts, registeredFiles };
};

describe("MVP workflow implementations", () => {
  it("scriptからfinal.mp4まで最小縦串を生成できる", async () => {
    const runId = `run-${Date.now()}`;
    const projectId = `project-${Date.now()}`;
    const evidenceRoot = path.join(process.cwd(), "outputs", "test_evidence", "task3", runId);
    const { prisma, updates, registeredFiles } = createPrismaMock(projectId, "AIで学ぶ宇宙ニュース");

    const ctx = {
      jobId: "job-integration",
      prisma,
      outputRoot: evidenceRoot,
    } as WorkflowContext;

    await runWorkflow(
      ctx,
      createDefaultWorkflowImplementations({
        outputRoot: evidenceRoot,
        disableRemotion: true,
        ttsProvider: "mock",
      })
    );

    const scriptPath = path.join(
      evidenceRoot,
      "projects",
      projectId,
      "output",
      "script_generation",
      "latest",
      "script.json"
    );
    const audioPath = path.join(
      evidenceRoot,
      "projects",
      projectId,
      "output",
      "tts_generation",
      "latest",
      "audio.wav"
    );
    const subtitlePath = path.join(
      evidenceRoot,
      "projects",
      projectId,
      "output",
      "subtitle_generation",
      "latest",
      "subtitles.ass"
    );
    const previewPath = path.join(
      evidenceRoot,
      "projects",
      projectId,
      "output",
      "video_composition",
      "latest",
      "preview.mp4"
    );
    const finalPath = path.join(
      evidenceRoot,
      "projects",
      projectId,
      "output",
      "final_encoding",
      "latest",
      "final.mp4"
    );

    await expect(fs.stat(scriptPath)).resolves.toBeTruthy();
    await expect(fs.stat(audioPath)).resolves.toBeTruthy();
    await expect(fs.stat(subtitlePath)).resolves.toBeTruthy();
    await expect(fs.stat(previewPath)).resolves.toBeTruthy();
    await expect(fs.stat(finalPath)).resolves.toBeTruthy();

    const completed = updates.filter((payload) => payload.data?.status === "COMPLETED");
    expect(completed.length).toBeGreaterThanOrEqual(5);
    expect(registeredFiles.length).toBeGreaterThanOrEqual(6);
  }, 120000);
});
