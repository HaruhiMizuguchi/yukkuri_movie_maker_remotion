import { z } from "zod";
import {
  WORKFLOW_STEPS,
  type WorkflowRunMode,
  type WorkflowRunOptions,
  type WorkflowStepName,
} from "@ymm/core";

const workflowStepSchema = z.enum(
  [...WORKFLOW_STEPS] as [WorkflowStepName, ...WorkflowStepName[]]
);
const runModeSchema = z.enum(["full", "resume"] as const);

const workflowPayloadSchema = z.object({
  jobId: z.string().uuid(),
  runMode: runModeSchema.optional(),
  skipSteps: z.array(workflowStepSchema).optional(),
});

export type WorkflowPayload = z.infer<typeof workflowPayloadSchema>;

export type WorkflowPayloadResult = {
  jobId: string;
  runOptions: WorkflowRunOptions;
};

export function parseWorkflowPayload(input: unknown): WorkflowPayloadResult {
  const payload = workflowPayloadSchema.parse(input);
  const runOptions: WorkflowRunOptions = {};

  if (payload.runMode) {
    runOptions.mode = payload.runMode as WorkflowRunMode;
  }

  if (payload.skipSteps && payload.skipSteps.length > 0) {
    runOptions.skipSteps = [...new Set(payload.skipSteps)];
  }

  return {
    jobId: payload.jobId,
    runOptions,
  };
}
