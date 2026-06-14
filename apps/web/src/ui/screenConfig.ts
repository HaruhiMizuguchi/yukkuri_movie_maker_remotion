export type ScreenId =
  | "dashboard"
  | "wizard"
  | "project"
  | "script"
  | "assets"
  | "timeline"
  | "preview"
  | "settings";

export const screens: Array<{ id: ScreenId; label: string }> = [
  { id: "dashboard", label: "ダッシュボード" },
  { id: "wizard", label: "作成ウィザード" },
  { id: "project", label: "プロジェクト詳細" },
  { id: "script", label: "台本編集" },
  { id: "assets", label: "素材管理" },
  { id: "timeline", label: "タイムライン" },
  { id: "preview", label: "プレビュー" },
  { id: "settings", label: "設定" },
];
