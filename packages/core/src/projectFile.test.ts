import { describe, expect, it, vi } from "vitest";

import { registerProjectFiles } from "./projectFile";

const createPrismaMock = () => {
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    projectFile: {
      createMany,
    },
  };

  return { prisma, createMany };
};

describe("registerProjectFiles", () => {
  it("成果物のメタデータをProjectFileとして登録する", async () => {
    const { prisma, createMany } = createPrismaMock();
    createMany.mockResolvedValue({ count: 2 });

    const count = await registerProjectFiles({
      prisma: prisma as any,
      jobId: "job-1",
      stepName: "tts_generation",
      fileCategory: "intermediate",
      artifacts: [
        {
          type: "audio",
          relativePath: "audio/voice.wav",
          fileCategory: "output",
          fileSizeBytes: 1200,
          durationMs: 1000,
        },
        {
          type: "subtitle",
          relativePath: "subs/lines.ass",
          fileSizeBytes: 42,
          format: "ass",
        },
      ],
    });

    expect(count).toBe(2);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          jobId: "job-1",
          stepName: "tts_generation",
          fileType: "audio",
          fileCategory: "output",
          relativePath: "audio/voice.wav",
          fileSizeBytes: BigInt(1200),
        },
        {
          jobId: "job-1",
          stepName: "tts_generation",
          fileType: "subtitle",
          fileCategory: "intermediate",
          relativePath: "subs/lines.ass",
          fileSizeBytes: BigInt(42),
        },
      ],
    });
  });

  it("成果物がない場合は登録をスキップする", async () => {
    const { prisma, createMany } = createPrismaMock();

    const count = await registerProjectFiles({
      prisma: prisma as any,
      jobId: "job-2",
      stepName: "script_generation",
      artifacts: [],
    });

    expect(count).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });
});
