import { describe, expect, it } from "vitest";

import { createAudioMixPlan } from "./audioMixPlan";

describe("audio mix plan", () => {
  it("ナレーション区間で BGM をダッキングする", () => {
    const plan = createAudioMixPlan({
      durationMs: 8000,
      timestamps: [
        { index: 0, speaker: "reimu", text: "一行目", startMs: 0, endMs: 2200 },
        { index: 1, speaker: "marisa", text: "二行目", startMs: 2600, endMs: 5200 },
      ],
      shotPlan: [],
      subtitlePresentation: {
        emphasisCount: 1,
        items: [
          {
            speaker: "reimu",
            text: "一行目",
            startMs: 0,
            endMs: 2200,
            keywordBadge: "結論",
            tokens: [{ text: "結論", kind: "emphasis" }],
          },
        ],
      },
    });

    expect(plan.bgmWindows.some((window) => window.volume < 0.2)).toBe(true);
    expect(plan.ambientWindows[0]).toMatchObject({ startMs: 0, endMs: 8000 });
  });

  it("強調字幕やショット切り替えから SE cue を作る", () => {
    const plan = createAudioMixPlan({
      durationMs: 9000,
      timestamps: [
        { index: 0, speaker: "reimu", text: "一行目", startMs: 0, endMs: 2400 },
      ],
      shotPlan: [
        {
          id: "shot-001",
          type: "wide",
          startMs: 0,
          endMs: 2400,
          lineIndexes: [0],
          focusSpeaker: "reimu",
          zoomStart: 1,
          zoomEnd: 1.04,
          panX: 0,
          panY: 0,
        },
        {
          id: "shot-002",
          type: "insert",
          startMs: 2400,
          endMs: 4800,
          lineIndexes: [1],
          focusSpeaker: "marisa",
          zoomStart: 1.1,
          zoomEnd: 1.16,
          panX: 0.08,
          panY: -0.04,
        },
      ],
      subtitlePresentation: {
        emphasisCount: 1,
        items: [
          {
            speaker: "reimu",
            text: "結論です",
            startMs: 0,
            endMs: 2400,
            keywordBadge: "結論",
            tokens: [{ text: "結論", kind: "emphasis" }],
          },
        ],
      },
    });

    expect(plan.seCues.length).toBeGreaterThanOrEqual(2);
    expect(plan.seCues.some((cue) => cue.kind === "accent")).toBe(true);
    expect(plan.seCues.some((cue) => cue.kind === "transition")).toBe(true);
  });
});
