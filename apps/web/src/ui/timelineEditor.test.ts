import { describe, expect, it } from "vitest";
import {
  addManualSubtitleClipLocal,
  deleteTimelineClipAndCloseGapLocal,
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

  it("完成動画モードの追加テロップは焼き込み済み字幕と別トラックへ置く", () => {
    const source = createTimeline();
    const timeline = addManualSubtitleClipLocal(
      {
        ...source,
        editingMode: "final-video",
        tracks: source.tracks.map((track) => ({ ...track, hidden: true })),
      },
      "追記テロップ",
      "manual-overlay-1",
    );

    expect(
      timeline.tracks.find((track) => track.id === "track-overlay-subtitle"),
    ).toMatchObject({
      hidden: false,
      clips: [expect.objectContaining({ text: "追記テロップ" })],
    });
    expect(timeline.tracks[0]?.hidden).toBe(true);
  });

  it("削除して詰める操作で後続の完成動画クリップだけを前へ移動する", () => {
    const timeline: TimelineData = {
      editingMode: "final-video",
      playbackRange: { inMs: 0, outMs: 6000 },
      markers: [{ id: "after-cut", timeMs: 5000, label: "後半" }],
      tracks: [
        {
          id: "track-final-video",
          name: "完成動画",
          type: "video",
          clips: [
            {
              id: "video-1",
              assetType: "video",
              assetPath: "final/final.mp4",
              startMs: 0,
              durationMs: 2000,
            },
            {
              id: "video-2",
              assetType: "video",
              assetPath: "final/final.mp4",
              startMs: 2000,
              durationMs: 1500,
            },
            {
              id: "video-3",
              assetType: "video",
              assetPath: "final/final.mp4",
              startMs: 4200,
              durationMs: 1800,
            },
          ],
        },
        {
          id: "track-overlay-subtitle",
          name: "追加テロップ",
          type: "subtitle",
          clips: [
            {
              id: "overlay-later",
              assetType: "subtitle",
              assetPath: "manual",
              startMs: 4800,
              durationMs: 500,
              text: "後半テロップ",
            },
          ],
        },
      ],
    };

    const updated = deleteTimelineClipAndCloseGapLocal(
      timeline,
      "track-final-video",
      "video-2",
    );

    expect(updated.tracks[0]?.clips).toMatchObject([
      { id: "video-1", startMs: 0 },
      { id: "video-3", startMs: 2700 },
    ]);
    expect(updated.tracks[1]?.clips[0]?.startMs).toBe(3300);
    expect(updated.markers[0]?.timeMs).toBe(3500);
    expect(updated.playbackRange.outMs).toBe(4500);
  });
});
