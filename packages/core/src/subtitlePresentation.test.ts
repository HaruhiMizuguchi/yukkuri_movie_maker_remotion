import { describe, expect, it } from "vitest";

import { createSubtitlePresentationPlan } from "./subtitlePresentation";

describe("subtitle presentation", () => {
  it("数字・英字語・重要語を強調トークンとして抽出する", () => {
    const plan = createSubtitlePresentationPlan({
      script: {
        title: "字幕",
        theme: "テスト",
        lines: [
          { speaker: "reimu", text: "結論として Remotion で 105秒 の動画を作れます。" },
        ],
      },
      timestamps: [
        {
          index: 0,
          speaker: "reimu",
          text: "結論として Remotion で 105秒 の動画を作れます。",
          startMs: 0,
          endMs: 3200,
        },
      ],
    });

    const highlightedTexts = plan.items[0]?.tokens
      .filter((token) => token.kind !== "plain")
      .map((token) => token.text);

    expect(highlightedTexts).toEqual(expect.arrayContaining(["結論", "Remotion", "105"]));
    expect(plan.items[0]?.keywordBadge).toBe("結論");
  });

  it("強調トークンを増やしすぎず、行ごとの上限を守る", () => {
    const plan = createSubtitlePresentationPlan({
      script: {
        title: "字幕",
        theme: "テスト",
        lines: [
          { speaker: "marisa", text: "AI TTS Remotion 重要 比較 2026 の要点です。" },
        ],
      },
      timestamps: [
        {
          index: 0,
          speaker: "marisa",
          text: "AI TTS Remotion 重要 比較 2026 の要点です。",
          startMs: 0,
          endMs: 2800,
        },
      ],
    });

    const emphasisCount = plan.items[0]?.tokens.filter((token) => token.kind === "emphasis").length;
    expect(emphasisCount).toBeLessThanOrEqual(3);
  });
});
