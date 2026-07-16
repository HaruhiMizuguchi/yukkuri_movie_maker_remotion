import { describe, expect, it } from "vitest";

import {
  addClip,
  addMarker,
  createFinalVideoEditingTimeline,
  deleteClip,
  duplicateClip,
  moveClip,
  resizeClip,
  setPlaybackRange,
  splitClip,
  synchronizeGeneratedTimelineTiming,
  timelineToRemotionProps,
  type TimelineData,
  updateClip,
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
    const updated = moveClip(sampleTimeline, {
      trackId: "t-audio",
      clipId: "clip-1",
      newStartMs: 2200,
    });

    expect(updated.tracks[0].clips[0].startMs).toBe(2200);
    expect(updated.tracks[0].clips[0].timingMode).toBe("manual");
  });

  it("クリップの長さを変更できる", () => {
    const updated = resizeClip(sampleTimeline, {
      trackId: "t-audio",
      clipId: "clip-1",
      newDurationMs: 8300,
    });

    expect(updated.tracks[0].clips[0].durationMs).toBe(8300);
    expect(updated.tracks[0].clips[0].timingMode).toBe("manual");
  });

  it("再生範囲を設定できる", () => {
    const updated = setPlaybackRange(sampleTimeline, {
      inMs: 1000,
      outMs: 9000,
    });

    expect(updated.playbackRange).toEqual({ inMs: 1000, outMs: 9000 });
  });

  it("Remotion向けpropsに変換できる", () => {
    const remotionProps = timelineToRemotionProps(sampleTimeline);

    expect(remotionProps.durationInFrames).toBe(360);
    expect(remotionProps.durationMs).toBe(12000);
    expect(remotionProps.subtitleTracks[0].text).toBe("サンプル字幕");
    expect(remotionProps.audioTracks[0]).toMatchObject({
      assetPath: "output/tts_generation/latest/audio.wav",
      startMs: 0,
      endMs: 6000,
      trimBeforeMs: 0,
      volume: 1,
    });
    expect(remotionProps.manualEditSummary).toMatchObject({
      subtitleClipCount: 1,
      audioClipCount: 1,
      markerCount: 1,
    });
  });

  it("字幕クリップを追加・複製・削除できる", () => {
    const added = addClip(sampleTimeline, {
      trackId: "t-sub",
      clip: {
        id: "clip-sub-2",
        assetType: "subtitle",
        assetPath: "output/subtitle_generation/latest/subtitles.json",
        startMs: 6200,
        durationMs: 1600,
        text: "手動テロップ",
        style: "editorial",
      },
    });
    expect(added.tracks[1].clips).toHaveLength(2);

    const duplicated = duplicateClip(added, {
      trackId: "t-sub",
      clipId: "clip-sub-2",
    });
    expect(duplicated.tracks[1].clips).toHaveLength(3);
    expect(duplicated.tracks[1].clips[2]?.id).toContain("clip-sub-2-copy");
    expect(duplicated.tracks[1].clips[2]?.startMs).toBe(7800);

    const deleted = deleteClip(duplicated, {
      trackId: "t-sub",
      clipId: "clip-sub-2",
    });
    expect(deleted.tracks[1].clips).toHaveLength(2);
    expect(
      deleted.tracks[1].clips.some((clip) => clip.id === "clip-sub-2"),
    ).toBe(false);
  });

  it("クリップを指定位置で分割できる", () => {
    const updated = splitClip(sampleTimeline, {
      trackId: "t-audio",
      clipId: "clip-1",
      splitAtMs: 2400,
    });

    expect(updated.tracks[0].clips).toHaveLength(2);
    expect(updated.tracks[0].clips[0]).toMatchObject({
      id: "clip-1",
      startMs: 0,
      durationMs: 2400,
      inMs: 0,
      outMs: 2400,
    });
    expect(updated.tracks[0].clips[1]).toMatchObject({
      id: "clip-1-split-2",
      startMs: 2400,
      durationMs: 3600,
      inMs: 2400,
      outMs: 6000,
    });
  });

  it("クリップ内容とマーカーを更新できる", () => {
    const updated = updateClip(sampleTimeline, {
      trackId: "t-sub",
      clipId: "clip-sub-1",
      patch: {
        text: "修正版テロップ",
        style: "important",
        startMs: 500,
        durationMs: 5500,
      },
    });
    const withMarker = addMarker(updated, {
      id: "m2",
      timeMs: 5200,
      label: "調整ポイント",
    });

    expect(withMarker.tracks[1].clips[0]).toMatchObject({
      text: "修正版テロップ",
      style: "important",
      startMs: 500,
      durationMs: 5500,
    });
    expect(withMarker.markers).toContainEqual({
      id: "m2",
      timeMs: 5200,
      label: "調整ポイント",
    });
  });

  it("再生範囲に合わせて字幕と音声を正規化できる", () => {
    const rangedTimeline: TimelineData = {
      playbackRange: { inMs: 1000, outMs: 7000 },
      markers: [
        { id: "m1", timeMs: 500, label: "除外" },
        { id: "m2", timeMs: 3000, label: "残す" },
      ],
      tracks: [
        {
          id: "track-audio",
          name: "音声",
          type: "audio",
          clips: [
            {
              id: "audio-main",
              assetType: "audio",
              assetPath: "output/tts_generation/latest/audio.wav",
              startMs: 0,
              durationMs: 9000,
              inMs: 0,
              outMs: 9000,
              volume: 0.8,
              fadeInMs: 300,
              fadeOutMs: 400,
            },
          ],
        },
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
              durationMs: 2500,
              text: "冒頭は途中から残る",
              style: "reimu",
            },
            {
              id: "sub-2",
              assetType: "subtitle",
              assetPath: "output/subtitle_generation/latest/subtitles.json",
              startMs: 5000,
              durationMs: 3000,
              text: "後半は途中で切れる",
              style: "marisa",
            },
          ],
        },
      ],
    };

    const remotionProps = timelineToRemotionProps(rangedTimeline);

    expect(remotionProps.durationMs).toBe(6000);
    expect(remotionProps.durationInFrames).toBe(180);
    expect(remotionProps.subtitleTracks).toEqual([
      {
        clipId: "sub-1",
        startMs: 0,
        endMs: 1500,
        text: "冒頭は途中から残る",
        speaker: "reimu",
      },
      {
        clipId: "sub-2",
        startMs: 4000,
        endMs: 6000,
        text: "後半は途中で切れる",
        speaker: "marisa",
      },
    ]);
    expect(remotionProps.audioTracks).toEqual([
      {
        clipId: "audio-main",
        assetPath: "output/tts_generation/latest/audio.wav",
        startMs: 0,
        endMs: 6000,
        trimBeforeMs: 1000,
        volume: 0.8,
        fadeInMs: 300,
        fadeOutMs: 400,
      },
    ]);
    expect(remotionProps.markers).toEqual([
      { id: "m2", timeMs: 2000, label: "残す" },
    ]);
  });

  it("推定尺の自動タイムラインをTTS実測タイムスタンプへ同期する", () => {
    const estimatedTimeline: TimelineData = {
      playbackRange: { inMs: 0, outMs: 2400 },
      markers: [{ id: "mk-start", timeMs: 0, label: "start" }],
      tracks: [
        {
          id: "track-audio",
          name: "音声",
          type: "audio",
          clips: [
            {
              id: "audio-main",
              assetType: "audio",
              assetPath: "output/tts_generation/latest/audio.wav",
              startMs: 0,
              durationMs: 2400,
              inMs: 0,
              outMs: 2400,
              volume: 1,
            },
          ],
        },
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
              durationMs: 1200,
              text: "一つ目の字幕",
              style: "霊夢",
            },
            {
              id: "sub-2",
              assetType: "subtitle",
              assetPath: "output/subtitle_generation/latest/subtitles.json",
              startMs: 1200,
              durationMs: 1200,
              text: "二つ目の字幕",
              style: "魔理沙",
            },
          ],
        },
      ],
    };

    const synchronized = synchronizeGeneratedTimelineTiming(estimatedTimeline, {
      audioDurationMs: 9000,
      timestamps: [
        {
          index: 0,
          speaker: "霊夢",
          text: "一つ目の字幕",
          startMs: 0,
          endMs: 4000,
        },
        {
          index: 1,
          speaker: "魔理沙",
          text: "二つ目の字幕",
          startMs: 4000,
          endMs: 9000,
        },
      ],
    });

    expect(synchronized.timeline.playbackRange).toEqual({
      inMs: 0,
      outMs: 9000,
    });
    expect(synchronized.timeline.tracks[0].clips[0]).toMatchObject({
      startMs: 0,
      durationMs: 9000,
      outMs: 9000,
      timingMode: "generated",
    });
    expect(synchronized.timeline.tracks[1].clips).toMatchObject([
      { id: "sub-1", startMs: 0, durationMs: 4000, timingMode: "generated" },
      { id: "sub-2", startMs: 4000, durationMs: 5000, timingMode: "generated" },
    ]);
    expect(synchronized.summary).toEqual({
      audioClipsAdjusted: 1,
      subtitleClipsAdjusted: 2,
      playbackRangeAdjusted: true,
      audioDurationMs: 9000,
    });
  });

  it("手動で調整したタイミングと明示的な再生範囲は保持する", () => {
    const manualTimeline: TimelineData = {
      ...sampleTimeline,
      playbackRange: { inMs: 1000, outMs: 5000 },
      tracks: sampleTimeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => ({
          ...clip,
          timingMode: "manual" as const,
        })),
      })),
    };

    const synchronized = synchronizeGeneratedTimelineTiming(manualTimeline, {
      audioDurationMs: 9000,
      timestamps: [
        {
          index: 0,
          speaker: "default",
          text: "サンプル字幕",
          startMs: 0,
          endMs: 9000,
        },
      ],
    });

    expect(synchronized.timeline).toEqual(manualTimeline);
    expect(synchronized.summary).toEqual({
      audioClipsAdjusted: 0,
      subtitleClipsAdjusted: 0,
      playbackRangeAdjusted: false,
      audioDurationMs: 9000,
    });
  });

  it("完成動画を二重表示・二重再生せず編集タイムラインへ取り込める", () => {
    const imported = createFinalVideoEditingTimeline(sampleTimeline, {
      assetPath: "final/final.mp4",
      durationMs: 11840,
      sourceName: "完成動画 2026-07-16",
    });

    expect(imported.editingMode).toBe("final-video");
    expect(imported.playbackRange).toEqual({ inMs: 0, outMs: 11840 });
    expect(imported.tracks.find((track) => track.id === "t-audio")?.muted).toBe(
      true,
    );
    expect(
      imported.tracks.find((track) => track.id === "t-sub")?.hidden,
    ).toBe(true);
    expect(
      imported.tracks.find((track) => track.id === "track-final-video"),
    ).toMatchObject({
      name: "完成動画 2026-07-16",
      type: "video",
      clips: [
        {
          id: "final-video-main",
          assetType: "video",
          assetPath: "final/final.mp4",
          startMs: 0,
          durationMs: 11840,
          inMs: 0,
          outMs: 11840,
          volume: 1,
        },
      ],
    });
    expect(
      imported.tracks.find((track) => track.id === "track-overlay-subtitle"),
    ).toMatchObject({ type: "subtitle", hidden: false, clips: [] });

    const remotionProps = timelineToRemotionProps(imported);
    expect(remotionProps.finalVideoEditMode).toBe(true);
    expect(remotionProps.audioTracks).toHaveLength(0);
    expect(remotionProps.subtitleTracks).toHaveLength(0);
    expect(remotionProps.videoTracks).toEqual([
      {
        clipId: "final-video-main",
        assetPath: "final/final.mp4",
        startMs: 0,
        endMs: 11840,
        trimBeforeMs: 0,
        volume: 1,
      },
    ]);
  });

  it("完成動画の分割・移動後も映像と内蔵音声の参照位置を保つ", () => {
    const imported = createFinalVideoEditingTimeline(sampleTimeline, {
      assetPath: "final/final.mp4",
      durationMs: 6000,
    });
    const split = splitClip(imported, {
      trackId: "track-final-video",
      clipId: "final-video-main",
      splitAtMs: 2000,
    });
    const moved = moveClip(split, {
      trackId: "track-final-video",
      clipId: "final-video-main-split-2",
      newStartMs: 3500,
    });

    expect(timelineToRemotionProps(moved).videoTracks).toEqual([
      expect.objectContaining({
        clipId: "final-video-main",
        startMs: 0,
        endMs: 2000,
        trimBeforeMs: 0,
      }),
      expect.objectContaining({
        clipId: "final-video-main-split-2",
        startMs: 3500,
        endMs: 6000,
        trimBeforeMs: 2000,
      }),
    ]);
  });

  it("完成動画編集モードではTTS再生成による自動同期を行わない", () => {
    const imported = createFinalVideoEditingTimeline(sampleTimeline, {
      assetPath: "final/final.mp4",
      durationMs: 6000,
    });

    const synchronized = synchronizeGeneratedTimelineTiming(imported, {
      audioDurationMs: 9000,
      timestamps: [
        {
          speaker: "reimu",
          text: "再生成された字幕",
          startMs: 0,
          endMs: 9000,
        },
      ],
    });

    expect(synchronized.timeline).toEqual(imported);
    expect(synchronized.summary).toEqual({
      audioClipsAdjusted: 0,
      subtitleClipsAdjusted: 0,
      playbackRangeAdjusted: false,
      audioDurationMs: 9000,
    });
  });
});
