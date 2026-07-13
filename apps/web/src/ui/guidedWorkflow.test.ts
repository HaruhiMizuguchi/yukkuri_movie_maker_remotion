import { describe, expect, it } from "vitest";
import { getRecommendedAction, getWorkflowPosition } from "./guidedWorkflow";

describe("guided workflow", () => {
  it("プロジェクトがない利用者を企画開始へ案内する", () => {
    expect(
      getRecommendedAction({
        hasProject: false,
        hasScript: false,
        hasFinalVideo: false,
        hasRunningJob: false,
      }),
    ).toEqual({
      screen: "wizard",
      label: "最初の動画を作る",
      description: "テーマを決めるだけで制作を始められます。",
    });
  });

  it("台本の有無と生成状態から次の一手を返す", () => {
    expect(
      getRecommendedAction({
        hasProject: true,
        hasScript: false,
        hasFinalVideo: false,
        hasRunningJob: false,
      }).screen,
    ).toBe("script");
    expect(
      getRecommendedAction({
        hasProject: true,
        hasScript: true,
        hasFinalVideo: false,
        hasRunningJob: true,
      }).screen,
    ).toBe("project");
    expect(
      getRecommendedAction({
        hasProject: true,
        hasScript: false,
        hasFinalVideo: true,
        hasRunningJob: false,
      }).screen,
    ).toBe("preview");
  });

  it("補助画面でも制作工程上の現在地を維持する", () => {
    expect(getWorkflowPosition("wizard")).toBe(1);
    expect(getWorkflowPosition("script")).toBe(2);
    expect(getWorkflowPosition("assets")).toBe(3);
    expect(getWorkflowPosition("timeline")).toBe(4);
    expect(getWorkflowPosition("preview")).toBe(5);
    expect(getWorkflowPosition("project")).toBeNull();
  });
});
