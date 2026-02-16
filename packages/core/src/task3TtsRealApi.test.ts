import { describe, expect, it } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  createDefaultWorkflowImplementations,
  type WorkflowContext,
} from "./index";

const loadAivisBaseUrl = async (): Promise<string | null> => {
  if (process.env.AIVIS_SPEECH_BASE_URL?.trim()) {
    return process.env.AIVIS_SPEECH_BASE_URL.trim();
  }

  try {
    const envText = await fs.readFile(path.join(process.cwd(), ".env"), "utf-8");
    const line = envText
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith("AIVIS_SPEECH_BASE_URL="));
    if (!line) {
      return null;
    }
    const value = line.split("=", 2)[1]?.trim();
    return value || null;
  } catch {
    return null;
  }
};

const createPrismaMock = (projectId: string, theme: string) => {
  const prisma: any = {
    workflowStep: {
      findMany: async () => [],
      upsert: async () => ({}),
      update: async () => ({}),
    },
    projectFile: {
      createMany: async ({ data }: { data: any[] }) => ({ count: data.length }),
    },
    job: {
      findUnique: async () => ({
        id: "job-aivis-real",
        projectId,
        mode: "full",
        project: { id: projectId, theme },
      }),
    },
  };
  return prisma;
};

describe("task3 tts real api", () => {
  it("AivisSpeechに実接続して音声ファイルを生成できる", async () => {
    const baseUrl = await loadAivisBaseUrl();
    if (!baseUrl) {
      return;
    }

    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "task3_quality",
      `tts-real-${Date.now()}`
    );
    const projectId = `project-${Date.now()}`;
    const projectRoot = path.join(outputRoot, "projects", projectId, "output", "script_generation", "latest");
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, "script.json"),
      `${JSON.stringify(
        {
          title: "Aivis実接続",
          theme: "Aivis実接続",
          lines: [
            { speaker: "reimu", text: "これはAivisSpeechの実接続テストです。" },
            { speaker: "marisa", text: "実際にAPIへ接続して音声を生成しています。" },
          ],
        },
        null,
        2
      )}\n`,
      "utf-8"
    );

    const implementations = createDefaultWorkflowImplementations({
      outputRoot,
      ttsProvider: "aivis",
      aivisBaseUrl: baseUrl,
    });

    const ctx = {
      jobId: "job-aivis-real",
      prisma: createPrismaMock(projectId, "Aivis実接続"),
      outputRoot,
    } as WorkflowContext;

    const result = await implementations.tts_generation?.(ctx);
    const audioPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "output",
      "tts_generation",
      "latest",
      "audio.wav"
    );

    const stat = await fs.stat(audioPath);
    expect(stat.size).toBeGreaterThan(10000);
    expect((result as { provider?: string } | undefined)?.provider).toBe("aivis");
  }, 120000);
});
