import { describe, expect, it } from "vitest";
import type { PreviewResponse } from "./apiTypes";
import {
  countCompletedManualReviews,
  getDeliveryState,
  getPreviewQualityChecks,
} from "./deliveryReview";

const preview = (): PreviewResponse => ({
  outputPreset: { width: 1920, height: 1080, fps: 30 },
  remotionProps: {
    durationInFrames: 135,
    durationMs: 4500,
    subtitleTracks: [{ text: "字幕", startMs: 0, endMs: 1000 }],
    audioTracks: [{ clipId: "voice-1", startMs: 0, endMs: 1000 }],
    markers: [],
    manualEditSummary: {
      subtitleClipCount: 1,
      audioClipCount: 1,
      markerCount: 0,
      playbackRangeApplied: true,
    },
  },
});

describe("getPreviewQualityChecks", () => {
  it("長さ・出力設定・字幕・音声を自動確認する", () => {
    const checks = getPreviewQualityChecks(preview());

    expect(checks).toHaveLength(4);
    expect(checks.every((check) => check.passed)).toBe(true);
    expect(checks.map((check) => check.id)).toEqual([
      "duration",
      "output",
      "subtitle",
      "audio",
    ]);
  });

  it("不足項目は理由付きで未通過にする", () => {
    const empty = preview();
    empty.outputPreset = undefined;
    empty.remotionProps.durationMs = 0;
    empty.remotionProps.subtitleTracks = [];
    empty.remotionProps.audioTracks = [];

    const checks = getPreviewQualityChecks(empty);
    expect(checks.every((check) => !check.passed)).toBe(true);
    expect(checks.map((check) => check.detail).join(" ")).toContain(
      "ありません",
    );
  });
});

describe("getDeliveryState", () => {
  it("プレビュー・生成・前回版の有無から表示状態を区別する", () => {
    expect(
      getDeliveryState({
        hasPreview: false,
        hasRunningJob: false,
        hasFinalVideo: false,
      }).key,
    ).toBe("needs-preview");
    expect(
      getDeliveryState({
        hasPreview: true,
        hasRunningJob: false,
        hasFinalVideo: false,
      }).key,
    ).toBe("ready");
    expect(
      getDeliveryState({
        hasPreview: true,
        hasRunningJob: true,
        hasFinalVideo: true,
      }),
    ).toMatchObject({
      key: "rendering-with-previous",
      downloadLabel: "前回版をダウンロード",
    });
    expect(
      getDeliveryState({
        hasPreview: true,
        hasRunningJob: false,
        hasFinalVideo: true,
      }).key,
    ).toBe("complete");
  });
});

describe("countCompletedManualReviews", () => {
  it("手動レビュー済み件数だけを数える", () => {
    expect(
      countCompletedManualReviews({
        picture: true,
        subtitle: false,
        audio: true,
        rights: false,
      }),
    ).toBe(2);
  });
});
