import { describe, expect, it, vi } from "vitest";

import {
  runWorkflow,
  MANUAL_SKIP_OUTPUT,
  SKIPPED_OUTPUT,
  type WorkflowContext,
  type WorkflowStepImplementations,
} from "./index";

const createPrismaMock = (workflowSteps: Array<any> = []) => {
  const updates: Array<any> = [];
  const upserts: Array<any> = [];
  const prisma = {
    workflowStep: {
      findMany: vi.fn().mockResolvedValue(workflowSteps),
      update: vi.fn().mockImplementation(async (payload) => {
        updates.push(payload);
        return payload;
      }),
    },
  };

  prisma.workflowStep.upsert = vi.fn().mockImplementation(async (payload) => {
    upserts.push(payload);
    return payload;
  });

  return { prisma, updates, upserts };
};

describe("runWorkflow", () => {
  it("実装されたステップを実行し、出力を保存する", async () => {
    const { prisma, updates } = createPrismaMock();
    const implementation = vi.fn().mockResolvedValue({ ok: "yes" });
    const implementations: WorkflowStepImplementations = {
      script_generation: implementation,
    };
    const ctx = { jobId: "job-1", prisma } as WorkflowContext;

    await runWorkflow(ctx, implementations);

    expect(implementation).toHaveBeenCalledWith(ctx);
    const update = updates.find(
      (payload) => payload.where.jobId_stepName.stepName === "script_generation"
    );
    expect(update?.data.status).toBe("COMPLETED");
    expect(update?.data.outputJson).toEqual({ ok: "yes" });
  });

  it("未実装のステップをスキップとして記録する", async () => {
    const { prisma, updates } = createPrismaMock();
    const ctx = { jobId: "job-2", prisma } as WorkflowContext;

    await runWorkflow(ctx, {});

    const update = updates.find(
      (payload) => payload.where.jobId_stepName.stepName === "theme_selection"
    );
    expect(update?.data.status).toBe("SKIPPED");
    expect(update?.data.outputJson).toEqual(SKIPPED_OUTPUT);
  });

  it("完了済みステップは既定で再実行しない", async () => {
    const { prisma, updates } = createPrismaMock([
      {
        jobId: "job-3",
        stepName: "script_generation",
        status: "COMPLETED",
      },
    ]);
    const implementation = vi.fn().mockResolvedValue({ ok: "again" });
    const ctx = { jobId: "job-3", prisma } as WorkflowContext;

    await runWorkflow(ctx, { script_generation: implementation });

    expect(implementation).not.toHaveBeenCalled();
    const update = updates.find(
      (payload) => payload.where.jobId_stepName.stepName === "script_generation"
    );
    expect(update).toBeUndefined();
  });

  it("失敗済みステップを再実行する", async () => {
    const { prisma, updates } = createPrismaMock([
      {
        jobId: "job-4",
        stepName: "script_generation",
        status: "FAILED",
      },
    ]);
    const implementation = vi.fn().mockResolvedValue({ ok: "retry" });
    const ctx = { jobId: "job-4", prisma } as WorkflowContext;

    await runWorkflow(ctx, { script_generation: implementation });

    expect(implementation).toHaveBeenCalledWith(ctx);
    const update = updates.find(
      (payload) => payload.where.jobId_stepName.stepName === "script_generation"
    );
    expect(update?.data.status).toBe("COMPLETED");
  });

  it("指定したステップを手動スキップとして記録する", async () => {
    const { prisma, upserts } = createPrismaMock();
    const implementation = vi.fn().mockResolvedValue({ ok: "skip" });
    const ctx = { jobId: "job-5", prisma } as WorkflowContext;

    await runWorkflow(ctx, { script_generation: implementation }, { skipSteps: ["script_generation"] });

    expect(implementation).not.toHaveBeenCalled();
    const upsert = upserts.find(
      (payload) => payload.where.jobId_stepName.stepName === "script_generation"
    );
    expect(upsert?.update.status).toBe("SKIPPED");
    expect(upsert?.update.outputJson).toEqual(MANUAL_SKIP_OUTPUT);
  });
});
