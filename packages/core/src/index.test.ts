import { describe, expect, it, vi } from "vitest";

import {
  runWorkflow,
  SKIPPED_OUTPUT,
  type WorkflowContext,
  type WorkflowStepImplementations,
} from "./index";

const createPrismaMock = () => {
  const updates: Array<any> = [];
  const prisma = {
    workflowStep: {
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockImplementation(async (payload) => {
        updates.push(payload);
        return payload;
      }),
    },
  };

  return { prisma, updates };
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
});
