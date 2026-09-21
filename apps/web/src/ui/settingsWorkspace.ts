import type { AppSettings } from "./apiTypes";

export const OUTPUT_PRESETS = [
  {
    id: "full-hd",
    label: "フルHD",
    detail: "YouTube・一般動画",
    outputPreset: { width: 1920, height: 1080, fps: 30 },
  },
  {
    id: "hd",
    label: "HD",
    detail: "軽量プレビュー",
    outputPreset: { width: 1280, height: 720, fps: 30 },
  },
  {
    id: "vertical-full-hd",
    label: "縦型ショート",
    detail: "Shorts・Reels",
    outputPreset: { width: 1080, height: 1920, fps: 30 },
  },
] as const;

export type OutputPresetId = (typeof OUTPUT_PRESETS)[number]["id"];

export const applyOutputPreset = (
  settings: AppSettings,
  presetId: OutputPresetId,
): AppSettings => {
  const preset = OUTPUT_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) return settings;
  return {
    ...settings,
    outputPreset: { ...preset.outputPreset },
  };
};

export const getSettingsValidationMessages = (
  settings: AppSettings,
): string[] => {
  const messages: string[] = [];
  const { width, height, fps } = settings.outputPreset;
  if (!Number.isInteger(width) || width < 320 || width > 7680) {
    messages.push("横幅は320〜7680の整数で入力してください");
  }
  if (!Number.isInteger(height) || height < 240 || height > 4320) {
    messages.push("高さは240〜4320の整数で入力してください");
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) {
    messages.push("FPSは1〜120の整数で入力してください");
  }
  return messages;
};

export const areSettingsEqual = (
  left: AppSettings,
  right: AppSettings,
): boolean =>
  left.models.script === right.models.script &&
  left.models.image === right.models.image &&
  left.outputPreset.width === right.outputPreset.width &&
  left.outputPreset.height === right.outputPreset.height &&
  left.outputPreset.fps === right.outputPreset.fps;

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b > 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a || 1;
};

export const getOutputAspectRatioLabel = (
  width: number,
  height: number,
): string => {
  if (width * 9 === height * 16) return "16:9 横型";
  if (width * 16 === height * 9) return "9:16 縦型";
  if (width === height) return "1:1 正方形";
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor} カスタム`;
};
