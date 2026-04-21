import { describe, expect, it } from "vitest";

import { createChapterPlan } from "./chapterPlan";

describe("chapter plan", () => {
  it("台本行数に応じて章を分割し、開始位置にトランジションを置く", () => {
    const plan = createChapterPlan({
      script: {
        title: "章",
        theme: "テスト",
        lines: [
          { speaker: "reimu", text: "導入です。" },
          { speaker: "marisa", text: "背景です。" },
          { speaker: "reimu", text: "要点1です。" },
          { speaker: "marisa", text: "要点2です。" },
          { speaker: "reimu", text: "補足です。" },
          { speaker: "marisa", text: "結論です。" },
        ],
      },
      timestamps: [
        { index: 0, speaker: "reimu", text: "導入です。", startMs: 0, endMs: 1200 },
        { index: 1, speaker: "marisa", text: "背景です。", startMs: 1200, endMs: 2600 },
        { index: 2, speaker: "reimu", text: "要点1です。", startMs: 2600, endMs: 4300 },
        { index: 3, speaker: "marisa", text: "要点2です。", startMs: 4300, endMs: 6100 },
        { index: 4, speaker: "reimu", text: "補足です。", startMs: 6100, endMs: 7600 },
        { index: 5, speaker: "marisa", text: "結論です。", startMs: 7600, endMs: 9200 },
      ],
    });

    expect(plan.chapters.length).toBeGreaterThanOrEqual(2);
    expect(plan.chapters[0]).toMatchObject({
      startMs: 0,
      title: "導入",
    });
    expect(plan.chapters.every((chapter) => chapter.transitionDurationMs > 0)).toBe(true);
    expect(plan.chapters.at(-1)?.endMs).toBe(9200);
  });
});
