import { describe, expect, it } from "vitest";
import type { ProjectAsset } from "./apiTypes";
import {
  getAssetFileName,
  getAssetFileValidationMessage,
  inferAssetSelection,
  summarizeAssetLibrary,
} from "./assetLibrary";

const file = (name: string, type: string, size = 1024) => ({
  name,
  type,
  size,
});

describe("inferAssetSelection", () => {
  it("ファイル名と形式から素材種別・用途・表示名を推定する", () => {
    expect(inferAssetSelection(file("立ち絵_reimu.PNG", "image/png"))).toEqual({
      type: "image",
      usage: "character",
      name: "立ち絵 reimu",
    });
    expect(
      inferAssetSelection(file("opening-theme.mp3", "audio/mpeg")),
    ).toEqual({
      type: "audio",
      usage: "bgm",
      name: "opening theme",
    });
    expect(inferAssetSelection(file("button-se.wav", "audio/wav"))).toEqual({
      type: "audio",
      usage: "se",
      name: "button se",
    });
    expect(inferAssetSelection(file("captions.srt", "text/plain"))).toEqual({
      type: "subtitle",
      usage: "reference",
      name: "captions",
    });
    expect(inferAssetSelection(file("intro.mp4", "video/mp4"))).toEqual({
      type: "video",
      usage: "reference",
      name: "intro",
    });
  });
});

describe("getAssetFileValidationMessage", () => {
  it("非対応形式・MIME不一致・上限超過を送信前に説明する", () => {
    expect(
      getAssetFileValidationMessage(file("background.png", "image/png")),
    ).toBeNull();
    expect(
      getAssetFileValidationMessage(
        file("large.mp4", "video/mp4", 250 * 1024 * 1024 + 1),
      ),
    ).toContain("250MB");
    expect(
      getAssetFileValidationMessage(
        file("program.exe", "application/x-msdownload"),
      ),
    ).toContain("対応していない");
    expect(
      getAssetFileValidationMessage(file("image.png", "video/mp4")),
    ).toContain("内容の種類");
  });
});

describe("summarizeAssetLibrary", () => {
  it("素材総数と種別・用途別内訳を集計する", () => {
    const assets: ProjectAsset[] = [
      {
        id: "bg",
        type: "image",
        usage: "background",
        name: "背景",
        relativePath: "projects/p/input/assets/backgrounds/bg.png",
        createdAt: "2026-07-16T00:00:00.000Z",
      },
      {
        id: "character",
        type: "image",
        usage: "character",
        name: "立ち絵",
        relativePath: "projects/p/input/assets/characters/reimu.png",
        createdAt: "2026-07-16T00:00:00.000Z",
      },
      {
        id: "bgm",
        type: "audio",
        usage: "bgm",
        name: "BGM",
        relativePath: "projects/p/input/assets/audio/bgm.mp3",
        createdAt: "2026-07-16T00:00:00.000Z",
      },
    ];

    expect(summarizeAssetLibrary(assets)).toEqual({
      total: 3,
      typeCounts: { image: 2, audio: 1 },
      usageCounts: { background: 1, character: 1, bgm: 1 },
    });
    expect(getAssetFileName(assets[0]!.relativePath)).toBe("bg.png");
  });
});
