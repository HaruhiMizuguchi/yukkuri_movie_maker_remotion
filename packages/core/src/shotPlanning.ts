import type { Script } from "@ymm/shared";

import type { ScriptTimestamp } from "./task3Quality";

export type ShotType = "wide" | "medium" | "close" | "insert";

export type ShotPlanItem = {
  id: string;
  type: ShotType;
  startMs: number;
  endMs: number;
  lineIndexes: number[];
  focusSpeaker: string;
  zoomStart: number;
  zoomEnd: number;
  panX: number;
  panY: number;
};

type ShotGroup = {
  startMs: number;
  endMs: number;
  lineIndexes: number[];
  focusSpeaker: string;
};

export const createShotPlan = ({
  script,
  timestamps,
}: {
  script: Script;
  timestamps: ScriptTimestamp[];
}): ShotPlanItem[] => {
  if (script.lines.length === 0 || timestamps.length === 0) {
    return [];
  }

  const groups: ShotGroup[] = [];
  let current: ShotGroup | null = null;

  for (const timestamp of timestamps) {
    const speaker = normalizeSpeaker(script.lines[timestamp.index]?.speaker ?? timestamp.speaker);
    const durationMs = timestamp.endMs - timestamp.startMs;
    const textLength = script.lines[timestamp.index]?.text.length ?? timestamp.text.length;
    const shouldSplit =
      !current ||
      current.focusSpeaker !== speaker ||
      current.endMs - current.startMs >= 6200 ||
      durationMs >= 3200 ||
      textLength >= 26;

    if (shouldSplit) {
      if (current) {
        groups.push(current);
      }
      current = {
        startMs: timestamp.startMs,
        endMs: timestamp.endMs,
        lineIndexes: [timestamp.index],
        focusSpeaker: speaker,
      };
      continue;
    }

    if (!current) {
      continue;
    }
    current.endMs = timestamp.endMs;
    current.lineIndexes.push(timestamp.index);
  }

  if (current) {
    groups.push(current);
  }

  return groups.map((group, index) => {
    const durationMs = group.endMs - group.startMs;
    const previousSpeaker = index > 0 ? groups[index - 1]?.focusSpeaker : null;
    const type = decideShotType({
      index,
      durationMs,
      previousSpeaker,
      currentSpeaker: group.focusSpeaker,
      lineCount: group.lineIndexes.length,
    });
    const motion = createShotMotion(type, group.focusSpeaker, index);

    return {
      id: `shot-${String(index + 1).padStart(3, "0")}`,
      type,
      startMs: group.startMs,
      endMs: group.endMs,
      lineIndexes: group.lineIndexes,
      focusSpeaker: group.focusSpeaker,
      ...motion,
    };
  });
};

const normalizeSpeaker = (speaker: string): string => speaker.trim().toLowerCase();

const decideShotType = ({
  index,
  durationMs,
  previousSpeaker,
  currentSpeaker,
  lineCount,
}: {
  index: number;
  durationMs: number;
  previousSpeaker: string | null | undefined;
  currentSpeaker: string;
  lineCount: number;
}): ShotType => {
  if (index === 0) {
    return "wide";
  }
  if (durationMs <= 2200 && lineCount === 1) {
    return "insert";
  }
  if (previousSpeaker && previousSpeaker !== currentSpeaker) {
    return "close";
  }
  if (durationMs >= 4800 || lineCount >= 2) {
    return "wide";
  }
  return "medium";
};

const createShotMotion = (
  type: ShotType,
  speaker: string,
  index: number
): Pick<ShotPlanItem, "zoomStart" | "zoomEnd" | "panX" | "panY"> => {
  const basePanX = speaker.includes("marisa") || speaker.includes("魔理沙") ? 0.08 : -0.08;
  const jitter = (index % 3) * 0.015;

  if (type === "wide") {
    return {
      zoomStart: 1.0,
      zoomEnd: 1.04 + jitter,
      panX: basePanX * 0.35,
      panY: -0.01,
    };
  }
  if (type === "close") {
    return {
      zoomStart: 1.1,
      zoomEnd: 1.16 + jitter,
      panX: basePanX,
      panY: -0.04,
    };
  }
  if (type === "insert") {
    return {
      zoomStart: 1.14,
      zoomEnd: 1.2 + jitter,
      panX: 0,
      panY: -0.06,
    };
  }
  return {
    zoomStart: 1.05,
    zoomEnd: 1.1 + jitter,
    panX: basePanX * 0.7,
    panY: -0.03,
  };
};
