import { describe, expect, it } from "vitest";

import { getGenerationProgress } from "./generationProgress";

describe("generation progress", () => {
  it("実行中ジョブの現在工程と完了率を人間向けに返す", () => {
    const progress = getGenerationProgress({
      status: "RUNNING",
      mode: "full",
      createdAt: "2026-07-15T00:00:00.000Z",
      steps: [
        { stepName: "theme_selection", status: "COMPLETED" },
        { stepName: "script_generation", status: "COMPLETED" },
        { stepName: "title_generation", status: "SKIPPED" },
        { stepName: "tts_generation", status: "RUNNING" },
      ],
    });

    expect(progress).toMatchObject({
      isActive: true,
      tone: "running",
      heading: "全自動で動画を生成しています",
      currentStepLabel: "音声生成",
      settledStepCount: 3,
      totalStepCount: 13,
      percentage: 23,
    });
    expect(progress.description).toContain("画面を閉じても処理は続きます");
  });

  it("待機中はキュー投入済みであることを明示する", () => {
    const progress = getGenerationProgress({
      status: "PENDING",
      mode: "full",
      createdAt: "2026-07-15T00:00:00.000Z",
      steps: [],
    });

    expect(progress).toMatchObject({
      isActive: true,
      tone: "pending",
      heading: "生成を受け付けました",
      currentStepLabel: "開始を待っています",
      percentage: 0,
    });
  });

  it("完了と失敗を次アクション付きで返す", () => {
    const completed = getGenerationProgress({
      status: "COMPLETED",
      mode: "full",
      createdAt: "2026-07-15T00:00:00.000Z",
      steps: [],
    });
    const failed = getGenerationProgress({
      status: "FAILED",
      mode: "full",
      createdAt: "2026-07-15T00:00:00.000Z",
      error: "quota exceeded",
      steps: [{ stepName: "script_generation", status: "FAILED" }],
    });

    expect(completed).toMatchObject({
      isActive: false,
      tone: "completed",
      heading: "動画の生成が完了しました",
      percentage: 100,
      action: "preview",
    });
    expect(failed).toMatchObject({
      isActive: false,
      tone: "failed",
      heading: "生成が途中で停止しました",
      currentStepLabel: "台本生成",
      action: "project",
    });
  });
});
