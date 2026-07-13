import type { ScreenId } from "./screenConfig";

export type WorkflowNavigationItem = {
  screen: ScreenId;
  step?: number;
  label: string;
  description: string;
};

export const primaryWorkflowNavigation: WorkflowNavigationItem[] = [
  {
    screen: "wizard",
    step: 1,
    label: "企画",
    description: "テーマと自動化範囲",
  },
  { screen: "script", step: 2, label: "台本", description: "話す内容を整える" },
  { screen: "assets", step: 3, label: "素材", description: "背景・立ち絵・音" },
  {
    screen: "timeline",
    step: 4,
    label: "編集",
    description: "タイミングと演出",
  },
  {
    screen: "preview",
    step: 5,
    label: "確認・出力",
    description: "動画を生成して確認",
  },
];

export type RecommendedAction = {
  screen: ScreenId;
  label: string;
  description: string;
};

export const getRecommendedAction = ({
  hasProject,
  hasScript,
  hasFinalVideo,
  hasRunningJob,
}: {
  hasProject: boolean;
  hasScript: boolean;
  hasFinalVideo: boolean;
  hasRunningJob: boolean;
}): RecommendedAction => {
  if (!hasProject) {
    return {
      screen: "wizard",
      label: "最初の動画を作る",
      description: "テーマを決めるだけで制作を始められます。",
    };
  }
  if (hasRunningJob) {
    return {
      screen: "project",
      label: "生成状況を見る",
      description: "完成までの進み具合を確認できます。",
    };
  }
  if (hasFinalVideo) {
    return {
      screen: "preview",
      label: "完成動画を見る",
      description: "再生確認やダウンロードができます。",
    };
  }
  if (!hasScript) {
    return {
      screen: "script",
      label: "台本を作る",
      description: "自動生成した台本を読みやすく整えます。",
    };
  }
  return {
    screen: "preview",
    label: "動画を確認・生成する",
    description: "内容を確認して完成動画を書き出します。",
  };
};

export const getWorkflowPosition = (screen: ScreenId): number | null =>
  primaryWorkflowNavigation.find((item) => item.screen === screen)?.step ??
  null;
