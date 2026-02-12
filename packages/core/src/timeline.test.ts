import { describe, expect, it } from "vitest";

import {
  moveClip,
  resizeClip,
  setPlaybackRange,
  timelineToRemotionProps,
  type TimelineData,
} from "./timeline";

const sampleTimeline: TimelineData = {
  playbackRange: { inMs: 0, outMs: 12000 },
  markers: [{ id: "m1", timeMs: 4000, label: "導入" }],
  tracks: [
    {
      id: "t-audio",
      name: "音声",
      type: "audio",
      clips: [
        {
          id: "clip-1",
          assetType: "audio",
          assetPath: "output/tts_generation/latest/audio.wav",
          startMs: 0,
          durationMs: 6000,
          inMs: 0,
          outMs: 6000,
          volume: 1,
        },
      ],
    },
    {
      id: "t-sub",
      name: "字幕",
      type: "subtitle",
      clips: [
        {
          id: "clip-sub-1",
          assetType: "subtitle",
          assetPath: "output/subtitle_generation/latest/subtitles.json",
          startMs: 0,
          durationMs: 6000,
          text: "サンプル字幕",
          style: "default",
        },
      ],
    },
  ],
};

describe("timeline operations", () => {
  it("クリップを指定位置に移動できる", () => {
    const updated = moveClip(sampleTimeline, { trackId: "t-audio", clipId: "clip-1", newStartMs: 2200 });

    expect(updated.tracks[0].clips[0].startMs).toBe(2200);
  });

  it("クリップの長さを変更できる", () => {
    const updated = resizeClip(sampleTimeline, {
      trackId: "t-audio",
      clipId: "clip-1",
      newDurationMs: 8300,
    });

    expect(updated.tracks[0].clips[0].durationMs).toBe(8300);
  });

  it("再生範囲を設定できる", () => {
    const updated = setPlaybackRange(sampleTimeline, { inMs: 1000, outMs: 9000 });

    expect(updated.playbackRange).toEqual({ inMs: 1000, outMs: 9000 });
  });

  it("Remotion向けpropsに変換できる", () => {
    const remotionProps = timelineToRemotionProps(sampleTimeline);

    expect(remotionProps.durationInFrames).toBe(360);
    expect(remotionProps.subtitleTracks[0].text).toBe("サンプル字幕");
  });
});
