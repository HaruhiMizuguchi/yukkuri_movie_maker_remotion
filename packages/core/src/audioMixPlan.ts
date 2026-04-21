import type { ShotPlanItem } from "./shotPlanning";
import type { SubtitlePresentationPlan } from "./subtitlePresentation";
import type { ScriptTimestamp } from "./task3Quality";

export type AudioWindow = {
  startMs: number;
  endMs: number;
  volume: number;
};

export type AudioSeCue = {
  id: string;
  kind: "accent" | "transition";
  assetKey: "accent" | "transition";
  startMs: number;
  durationMs: number;
  volume: number;
};

export type AudioMixPlan = {
  bgmWindows: AudioWindow[];
  ambientWindows: AudioWindow[];
  seCues: AudioSeCue[];
};

export const createAudioMixPlan = ({
  durationMs,
  timestamps,
  shotPlan,
  subtitlePresentation,
}: {
  durationMs: number;
  timestamps: ScriptTimestamp[];
  shotPlan: ShotPlanItem[];
  subtitlePresentation: SubtitlePresentationPlan;
}): AudioMixPlan => {
  const bgmWindows = buildBgmWindows(durationMs, timestamps);
  const ambientWindows = [{ startMs: 0, endMs: durationMs, volume: 0.08 }];
  const seCues: AudioSeCue[] = [];

  subtitlePresentation.items.forEach((item, index) => {
    if (!item.keywordBadge) {
      return;
    }
    seCues.push({
      id: `accent-${index + 1}`,
      kind: "accent",
      assetKey: "accent",
      startMs: Math.max(0, item.startMs + 90),
      durationMs: 320,
      volume: 0.34,
    });
  });

  shotPlan.forEach((shot, index) => {
    if (index === 0) {
      return;
    }
    if (shot.type !== "insert" && shot.type !== "close") {
      return;
    }
    seCues.push({
      id: `transition-${index + 1}`,
      kind: "transition",
      assetKey: "transition",
      startMs: Math.max(0, shot.startMs - 80),
      durationMs: 420,
      volume: 0.28,
    });
  });

  return {
    bgmWindows,
    ambientWindows,
    seCues,
  };
};

const buildBgmWindows = (
  durationMs: number,
  timestamps: ScriptTimestamp[]
): AudioWindow[] => {
  const windows: AudioWindow[] = [];
  let cursor = 0;

  for (const timestamp of timestamps) {
    const duckStart = Math.max(0, timestamp.startMs - 120);
    const duckEnd = Math.min(durationMs, timestamp.endMs + 180);
    if (cursor < duckStart) {
      windows.push({
        startMs: cursor,
        endMs: duckStart,
        volume: 0.26,
      });
    }
    windows.push({
      startMs: duckStart,
      endMs: duckEnd,
      volume: 0.14,
    });
    cursor = duckEnd;
  }

  if (cursor < durationMs) {
    windows.push({
      startMs: cursor,
      endMs: durationMs,
      volume: 0.26,
    });
  }

  return mergeWindows(windows);
};

const mergeWindows = (windows: AudioWindow[]): AudioWindow[] => {
  if (windows.length === 0) {
    return [];
  }

  const merged: AudioWindow[] = [windows[0]!];
  for (let index = 1; index < windows.length; index += 1) {
    const current = windows[index]!;
    const previous = merged[merged.length - 1]!;
    if (previous.endMs === current.startMs && previous.volume === current.volume) {
      previous.endMs = current.endMs;
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
};
