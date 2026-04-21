import type { Script } from "@ymm/shared";

import type { ScriptTimestamp } from "./task3Quality";

export type ChapterPlanItem = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  lineIndexes: number[];
  transitionDurationMs: number;
};

export type ChapterPlan = {
  chapters: ChapterPlanItem[];
};

const DEFAULT_TITLES = ["導入", "要点整理", "補足", "まとめ"];

export const createChapterPlan = ({
  script,
  timestamps,
}: {
  script: Script;
  timestamps: ScriptTimestamp[];
}): ChapterPlan => {
  if (script.lines.length === 0 || timestamps.length === 0) {
    return { chapters: [] };
  }

  const linesPerChapter = Math.max(2, Math.ceil(script.lines.length / 3));
  const chapters: ChapterPlanItem[] = [];

  for (let startIndex = 0; startIndex < script.lines.length; startIndex += linesPerChapter) {
    const endIndex = Math.min(script.lines.length - 1, startIndex + linesPerChapter - 1);
    const startMs = timestamps[startIndex]?.startMs ?? 0;
    const endMs = timestamps[endIndex]?.endMs ?? startMs + 1000;
    const chapterIndex = chapters.length;

    chapters.push({
      id: `chapter-${String(chapterIndex + 1).padStart(2, "0")}`,
      title: DEFAULT_TITLES[chapterIndex] ?? `章 ${chapterIndex + 1}`,
      startMs,
      endMs,
      lineIndexes: Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => startIndex + offset),
      transitionDurationMs: 720,
    });
  }

  return { chapters };
};
