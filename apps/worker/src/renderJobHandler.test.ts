import { JobStatus, StepStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { WORKFLOW_STEPS } from "@ymm/core";
import { handleRenderJobPayload } from "./renderJobHandler";

const createPrismaMock = () => ({
  workflowStep: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  job: {
    update: vi.fn().mockResolvedValue({}),
  },
});

describe("handleRenderJobPayload", () => {
  it("不正ペイロードでもjobIdが読める場合はJobをFAILEDにする", async () => {
    const prisma = createPrismaMock();

    await expect(
      handleRenderJobPayload({
        payload: {
          jobId: "11111111-1111-1111-1111-111111111111",
          skipSteps: ["invalid_step"],
        },
        prisma: prisma as any,
        implementations: {},
        runWorkflowImpl: vi.fn(),
      })
    ).rejects.toThrow();

    expect(prisma.workflowStep.upsert).not.toHaveBeenCalled();
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "11111111-1111-1111-1111-111111111111" },
      data: {
        status: JobStatus.FAILED,
        error: expect.stringContaining("Invalid workflow payload"),
      },
    });
  });

  it("正常ペイロードではステップ初期化後にワークフローを実行する", async () => {
    const prisma = createPrismaMock();
    const runWorkflowImpl = vi.fn().mockResolvedValue(undefined);

    await handleRenderJobPayload({
      payload: { jobId: "22222222-2222-2222-2222-222222222222" },
      prisma: prisma as any,
      implementations: {},
      runWorkflowImpl,
    });

    expect(prisma.workflowStep.upsert).toHaveBeenCalledTimes(WORKFLOW_STEPS.length);
    expect(prisma.workflowStep.upsert).toHaveBeenCalledWith({
      where: {
        jobId_stepName: {
          jobId: "22222222-2222-2222-2222-222222222222",
          stepName: WORKFLOW_STEPS[0],
        },
      },
      update: {},
      create: {
        jobId: "22222222-2222-2222-2222-222222222222",
        stepName: WORKFLOW_STEPS[0],
        status: StepStatus.PENDING,
      },
    });
    expect(runWorkflowImpl).toHaveBeenCalled();
    expect(prisma.job.update).toHaveBeenLastCalledWith({
      where: { id: "22222222-2222-2222-2222-222222222222" },
      data: { status: JobStatus.COMPLETED },
    });
  });
});
