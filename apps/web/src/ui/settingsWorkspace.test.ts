import { describe, expect, it } from "vitest";
import type { AppSettings } from "./apiTypes";
import {
  applyOutputPreset,
  areSettingsEqual,
  getOutputAspectRatioLabel,
  getSettingsValidationMessages,
} from "./settingsWorkspace";

const settings = (): AppSettings => ({
  models: {
    script: "gemini-3.5-flash",
    image: "gemini-3.1-flash-lite-image",
  },
  outputPreset: { width: 1920, height: 1080, fps: 30 },
});

describe("getSettingsValidationMessages", () => {
  it("出力サイズとFPSの範囲・整数を検証する", () => {
    expect(getSettingsValidationMessages(settings())).toEqual([]);
    expect(
      getSettingsValidationMessages({
        ...settings(),
        outputPreset: { width: 100, height: 1080.5, fps: 121 },
      }),
    ).toEqual([
      "横幅は320〜7680の整数で入力してください",
      "高さは240〜4320の整数で入力してください",
      "FPSは1〜120の整数で入力してください",
    ]);
  });
});

describe("applyOutputPreset", () => {
  it("モデル選択を保ったまま用途別出力プリセットを適用する", () => {
    const source = settings();
    const vertical = applyOutputPreset(source, "vertical-full-hd");
    expect(vertical.outputPreset).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
    });
    expect(vertical.models).toEqual(source.models);
    expect(source.outputPreset).toEqual({ width: 1920, height: 1080, fps: 30 });
  });
});

describe("設定比較と比率表示", () => {
  it("保存基準との一致と代表的な縦横比を判定する", () => {
    const source = settings();
    expect(
      areSettingsEqual(source, { ...source, models: { ...source.models } }),
    ).toBe(true);
    expect(areSettingsEqual(source, applyOutputPreset(source, "hd"))).toBe(
      false,
    );
    expect(getOutputAspectRatioLabel(1920, 1080)).toBe("16:9 横型");
    expect(getOutputAspectRatioLabel(1080, 1920)).toBe("9:16 縦型");
    expect(getOutputAspectRatioLabel(1000, 1000)).toBe("1:1 正方形");
  });
});
