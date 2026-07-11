export type AutomationMode = "full" | "scriptOnly" | "renderOnly" | "custom";

export const workflowSteps = [
  "theme_selection",
  "script_generation",
  "title_generation",
  "tts_generation",
  "character_synthesis",
  "background_generation",
  "background_animation",
  "subtitle_generation",
  "video_composition",
  "audio_enhancement",
  "illustration_insertion",
  "final_encoding",
  "youtube_upload",
] as const;

export type WorkflowStepName = (typeof workflowSteps)[number];

export const workflowStepLabels: Record<WorkflowStepName, string> = {
  theme_selection: "テーマ選定",
  script_generation: "台本生成",
  title_generation: "タイトル生成",
  tts_generation: "音声生成",
  character_synthesis: "立ち絵/表情",
  background_generation: "背景生成",
  background_animation: "背景演出",
  subtitle_generation: "字幕生成",
  video_composition: "動画合成",
  audio_enhancement: "音響演出",
  illustration_insertion: "挿絵追加",
  final_encoding: "最終エンコード",
  youtube_upload: "YouTube連携",
};

export const automationModeLabels: Record<AutomationMode, string> = {
  full: "全自動",
  scriptOnly: "台本まで",
  renderOnly: "編集済み素材から",
  custom: "カスタム",
};

export const buildJobRequest = (
  mode: AutomationMode,
  skipSteps: string[]
): { mode: AutomationMode; runMode: "resume"; skipSteps?: WorkflowStepName[] } => {
  const knownSteps = new Set(workflowSteps);
  const uniqueSkipSteps = [
    ...new Set(skipSteps.filter((step): step is WorkflowStepName => knownSteps.has(step as WorkflowStepName))),
  ];
  return {
    mode,
    runMode: "resume",
    ...(mode === "custom" && uniqueSkipSteps.length > 0 ? { skipSteps: uniqueSkipSteps } : {}),
  };
};
