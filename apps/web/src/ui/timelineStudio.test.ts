import { describe, expect, it } from "vitest";
import {
  getTimelineTrackTypeLabel,
  resolveTimelineShortcut,
} from "./timelineStudio";

describe("resolveTimelineShortcut", () => {
  it("編集画面の主要操作をキーボードから呼び出せる", () => {
    expect(resolveTimelineShortcut({ key: " " })).toEqual({
      type: "toggle-playback",
    });
    expect(resolveTimelineShortcut({ key: "s" })).toEqual({
      type: "split-clip",
    });
    expect(resolveTimelineShortcut({ key: "Delete" })).toEqual({
      type: "delete-clip",
    });
    expect(resolveTimelineShortcut({ key: "ArrowLeft" })).toEqual({
      type: "nudge-playhead",
      deltaMs: -100,
    });
    expect(
      resolveTimelineShortcut({ key: "ArrowRight", shiftKey: true }),
    ).toEqual({ type: "nudge-playhead", deltaMs: 1_000 });
  });

  it("WindowsとmacOSのUndo・Redo操作を解決する", () => {
    expect(resolveTimelineShortcut({ key: "z", ctrlKey: true })).toEqual({
      type: "undo",
    });
    expect(
      resolveTimelineShortcut({ key: "z", metaKey: true, shiftKey: true }),
    ).toEqual({ type: "redo" });
    expect(resolveTimelineShortcut({ key: "y", ctrlKey: true })).toEqual({
      type: "redo",
    });
  });

  it("フォーム入力中や予約外の修飾キーでは編集操作を発火しない", () => {
    expect(
      resolveTimelineShortcut({ key: "s", isEditingField: true }),
    ).toBeNull();
    expect(resolveTimelineShortcut({ key: "s", ctrlKey: true })).toBeNull();
    expect(resolveTimelineShortcut({ key: "Escape" })).toBeNull();
  });
});

describe("getTimelineTrackTypeLabel", () => {
  it("内部トラック種別を画面向けの日本語へ変換する", () => {
    expect(getTimelineTrackTypeLabel("video")).toBe("映像");
    expect(getTimelineTrackTypeLabel("audio")).toBe("音声");
    expect(getTimelineTrackTypeLabel("subtitle")).toBe("字幕");
    expect(getTimelineTrackTypeLabel("unknown")).toBe("その他");
  });
});
