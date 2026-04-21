import { describe, expect, it } from "vitest";

import { createCharacterPerformancePlan } from "./characterPerformance";

describe("character performance", () => {
  it("発話区間から口パク cue を複数生成する", () => {
    const plan = createCharacterPerformancePlan({
      script: {
        title: "演技",
        theme: "テスト",
        lines: [
          { speaker: "reimu", text: "ここは口パクが続く区間です。" },
          { speaker: "marisa", text: "次のセリフも少し長めにしておくぜ。" },
        ],
      },
      timestamps: [
        { index: 0, speaker: "reimu", text: "ここは口パクが続く区間です。", startMs: 0, endMs: 2200 },
        { index: 1, speaker: "marisa", text: "次のセリフも少し長めにしておくぜ。", startMs: 2200, endMs: 4700 },
      ],
    });

    expect(plan.mouthCues.length).toBeGreaterThanOrEqual(8);
    expect(plan.mouthCues[0]?.startMs).toBe(0);
    expect(plan.mouthCues.every((cue) => cue.endMs > cue.startMs)).toBe(true);
  });

  it("長尺タイムラインでは blink cue と感情推定を生成する", () => {
    const plan = createCharacterPerformancePlan({
      script: {
        title: "演技",
        theme: "テスト",
        lines: [
          { speaker: "reimu", text: "重要な結論です。", emotion: "serious" },
          { speaker: "marisa", text: "本当にそうなのか！？" },
          { speaker: "reimu", text: "うまくいきました！" },
        ],
      },
      timestamps: [
        { index: 0, speaker: "reimu", text: "重要な結論です。", startMs: 0, endMs: 2500 },
        { index: 1, speaker: "marisa", text: "本当にそうなのか！？", startMs: 2500, endMs: 5200 },
        { index: 2, speaker: "reimu", text: "うまくいきました！", startMs: 5200, endMs: 9800 },
      ],
    });

    expect(plan.blinkCues.length).toBeGreaterThanOrEqual(2);
    expect(plan.expressionCues.map((cue) => cue.expression)).toEqual([
      "serious",
      "surprised",
      "happy",
    ]);
  });
});
