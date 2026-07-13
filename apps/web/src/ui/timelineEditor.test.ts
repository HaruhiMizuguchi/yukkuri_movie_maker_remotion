import { describe, expect, it } from "vitest";
import {
  addManualSubtitleClipLocal,
  splitTimelineClipLocal,
  summarizeTimelineDraft,
  type TimelineData,
  updateTimelineClipLocal,
} from "./timelineEditor";

const createTimeline = (): TimelineData => ({
  playbackRange: { inMs: 0, outMs: 4000 },
  markers: [],
  tracks: [
    {
      id: "track-subtitle",
      name: "字幕",
      type: "subtitle",
      clips: [
        {
          id: "sub-1",
          assetType: "subtitle",
          assetPath: "output/subtitle_generation/latest/subtitles.json",
          startMs: 0,
          durationMs: 4000,
          text: "元の字幕",
        },
      ],
    },
  ],
});

describe("timelineEditor", () => {
  it("手動字幕クリップを追加して集計できる", () => {
    const timeline = addManualSubtitleClipLocal(
      createTimeline(),
      "追加字幕",
      "manual-1",
    );

    expect(timeline.tracks[0]?.clips).toHaveLength(2);
    expect(timeline.tracks[0]?.clips[1]?.timingMode).toBe("manual");
    expect(summarizeTimelineDraft(timeline).subtitleClipCount).toBe(2);
  });

  it("選択クリップをプレイヘッドで分割できる", () => {
    const timeline = splitTimelineClipLocal(
      createTimeline(),
      "track-subtitle",
      "sub-1",
      1500,
    );
    const clips = timeline.tracks[0]?.clips ?? [];

    expect(clips).toHaveLength(2);
    expect(clips[0]?.durationMs).toBe(1500);
    expect(clips[0]?.timingMode).toBe("manual");
    expect(clips[1]?.startMs).toBe(1500);
    expect(clips[1]?.durationMs).toBe(2500);
    expect(clips[1]?.timingMode).toBe("manual");
  });

  it("GUIで位置や長さを変えたクリップを手動タイミングとして記録する", () => {
    const timeline = updateTimelineClipLocal(
      createTimeline(),
      "track-subtitle",
      "sub-1",
      { startMs: 500, durationMs: 3000 },
    );

    expect(timeline.tracks[0]?.clips[0]).toMatchObject({
      startMs: 500,
      durationMs: 3000,
      timingMode: "manual",
    });
  });
});
