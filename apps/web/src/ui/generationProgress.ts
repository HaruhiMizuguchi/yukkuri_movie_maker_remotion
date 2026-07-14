import {
  workflowStepLabels,
  workflowSteps,
  type WorkflowStepName,
} from "./automationProfiles";
import type { ScreenId } from "./screenConfig";

type GenerationStep = {
  stepName: string;
  status: string;
};

type GenerationJob = {
  status: string;
  mode: string;
  createdAt: string;
  error?: string | null;
  steps: GenerationStep[];
};

export type GenerationProgress = {
  isActive: boolean;
  tone: "pending" | "running" | "completed" | "failed" | "cancelled";
  heading: string;
  description: string;
  currentStepLabel: string;
  settledStepCount: number;
  totalStepCount: number;
  percentage: number;
  action: ScreenId;
};

const settledStatuses = new Set(["COMPLETED", "SKIPPED"]);

export const getGenerationProgress = (
  job: GenerationJob,
): GenerationProgress => {
  const totalStepCount = workflowSteps.length;
  const settledStepCount = job.steps.filter((step) =>
    settledStatuses.has(step.status),
  ).length;
  const currentStep =
    job.steps.find((step) => step.status === "RUNNING") ??
    job.steps.find((step) => step.status === "FAILED") ??
    job.steps.find((step) => step.status === "PENDING");
  const currentStepLabel = currentStep
    ? (workflowStepLabels[currentStep.stepName as WorkflowStepName] ??
      currentStep.stepName)
    : "処理内容を確認中";

  if (job.status === "PENDING") {
    return {
      isActive: true,
      tone: "pending",
      heading: "生成を受け付けました",
      description:
        "順番が来ると自動で開始します。この画面は2秒ごとに更新されます。",
      currentStepLabel: "開始を待っています",
      settledStepCount,
      totalStepCount,
      percentage: 0,
      action: "project",
    };
  }

  if (job.status === "RUNNING") {
    return {
      isActive: true,
      tone: "running",
      heading:
        job.mode === "full"
          ? "全自動で動画を生成しています"
          : "動画を生成しています",
      description:
        "画面を閉じても処理は続きます。状態は2秒ごとに自動更新されます。",
      currentStepLabel,
      settledStepCount,
      totalStepCount,
      percentage: Math.round((settledStepCount / totalStepCount) * 100),
      action: "project",
    };
  }

  if (job.status === "COMPLETED") {
    return {
      isActive: false,
      tone: "completed",
      heading: "動画の生成が完了しました",
      description: "完成動画を再生して、内容と音声を確認できます。",
      currentStepLabel: "すべての工程が完了",
      settledStepCount: totalStepCount,
      totalStepCount,
      percentage: 100,
      action: "preview",
    };
  }

  if (job.status === "FAILED") {
    return {
      isActive: false,
      tone: "failed",
      heading: "生成が途中で停止しました",
      description: "失敗した工程と理由を確認し、その工程から再実行できます。",
      currentStepLabel,
      settledStepCount,
      totalStepCount,
      percentage: Math.round((settledStepCount / totalStepCount) * 100),
      action: "project",
    };
  }

  return {
    isActive: false,
    tone: "cancelled",
    heading: "生成はキャンセルされました",
    description: "必要であれば同じ設定で生成をやり直せます。",
    currentStepLabel: "停止",
    settledStepCount,
    totalStepCount,
    percentage: Math.round((settledStepCount / totalStepCount) * 100),
    action: "project",
  };
};
