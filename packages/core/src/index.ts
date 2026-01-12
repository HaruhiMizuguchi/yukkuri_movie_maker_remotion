import type { PrismaClient } from "@prisma/client";

export type WorkflowContext = {
  jobId: string;
  prisma: PrismaClient;
};

/**
 * 最小のワークフロー実行器（雛形）。
 * 各ステップ実装（LLM/TTS/Remotion/FFmpeg）は今後ここに追加します。
 */
export async function runWorkflow(ctx: WorkflowContext): Promise<void> {
  // TODO: ステップを順次実行し、workflow_steps を更新する
  await ctx.prisma.workflowStep.updateMany({
    where: { jobId: ctx.jobId },
    data: {},
  });
}

