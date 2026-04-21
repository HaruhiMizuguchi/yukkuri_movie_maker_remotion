import { describe, expect, it } from "vitest";

import { createShotPlan } from "./shotPlanning";

describe("shot planning", () => {
  it("同一話者の短い連続セリフをまとめつつ、話者交代でショットを切り替える", () => {
    const shots = createShotPlan({
      script: {
        title: "ショット割り",
        theme: "テスト",
        lines: [
          { speaker: "reimu", text: "導入です。" },
          { speaker: "reimu", text: "補足です。" },
          { speaker: "marisa", text: "ここで視点を変えるぜ。" },
          { speaker: "reimu", text: "結論です。" },
        ],
      },
      timestamps: [
        { index: 0, speaker: "reimu", text: "導入です。", startMs: 0, endMs: 1800 },
        { index: 1, speaker: "reimu", text: "補足です。", startMs: 1800, endMs: 3600 },
        { index: 2, speaker: "marisa", text: "ここで視点を変えるぜ。", startMs: 3600, endMs: 7000 },
        { index: 3, speaker: "reimu", text: "結論です。", startMs: 7000, endMs: 9000 },
      ],
    });

    expect(shots).toHaveLength(3);
    expect(shots[0]).toMatchObject({
      lineIndexes: [0, 1],
      startMs: 0,
      endMs: 3600,
      type: "wide",
    });
    expect(shots[1]).toMatchObject({
      lineIndexes: [2],
      startMs: 3600,
      endMs: 7000,
      type: "close",
      focusSpeaker: "marisa",
    });
    expect(shots[2]).toMatchObject({
      lineIndexes: [3],
      startMs: 7000,
      endMs: 9000,
      focusSpeaker: "reimu",
    });
  });

  it("ショット全体でタイムラインを切れ目なく覆う", () => {
    const shots = createShotPlan({
      script: {
        title: "ショット割り",
        theme: "テスト",
        lines: [
          { speaker: "reimu", text: "一行目です。" },
          { speaker: "marisa", text: "二行目です。" },
          { speaker: "marisa", text: "三行目です。" },
        ],
      },
      timestamps: [
        { index: 0, speaker: "reimu", text: "一行目です。", startMs: 0, endMs: 2000 },
        { index: 1, speaker: "marisa", text: "二行目です。", startMs: 2000, endMs: 4300 },
        { index: 2, speaker: "marisa", text: "三行目です。", startMs: 4300, endMs: 6500 },
      ],
    });

    expect(shots[0]?.startMs).toBe(0);
    expect(shots.at(-1)?.endMs).toBe(6500);
    for (let index = 1; index < shots.length; index += 1) {
      expect(shots[index - 1]?.endMs).toBe(shots[index]?.startMs);
    }
  });
});
