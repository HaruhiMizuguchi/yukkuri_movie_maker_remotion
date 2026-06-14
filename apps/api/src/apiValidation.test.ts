import { describe, expect, it } from "vitest";
import {
  buildSafeAssetFilename,
  canAccessProject,
  normalizeProjectRelativePath,
  parseCreateJobBody,
  prepareSettingsForStorage,
} from "./apiValidation";

describe("api validation", () => {
  it("skipStepsを既知のワークフローステップだけに制限する", () => {
    expect(
      parseCreateJobBody({
        mode: "full",
        runMode: "resume",
        skipSteps: ["tts_generation", "subtitle_generation"],
      })
    ).toEqual({
      mode: "full",
      runMode: "resume",
      skipSteps: ["tts_generation", "subtitle_generation"],
    });

    expect(() =>
      parseCreateJobBody({ skipSteps: ["../../not-a-step"] })
    ).toThrow();
  });

  it("アップロード保存用ファイル名のパストラバーサルを拒否する", () => {
    expect(buildSafeAssetFilename("asset-1", "png")).toBe("asset-1.png");
    expect(buildSafeAssetFilename("asset_2", ".jpg")).toBe("asset_2.jpg");

    expect(() => buildSafeAssetFilename("../asset", "png")).toThrow();
    expect(() => buildSafeAssetFilename("asset", "../png")).toThrow();
    expect(() => buildSafeAssetFilename("asset/name", "png")).toThrow();
  });

  it("既存素材参照の相対パスをプロジェクト内参照に制限する", () => {
    expect(normalizeProjectRelativePath("input/assets/bg.png")).toBe("input/assets/bg.png");
    expect(normalizeProjectRelativePath("input\\assets\\bg.png")).toBe("input/assets/bg.png");

    expect(() => normalizeProjectRelativePath("../.env")).toThrow();
    expect(() => normalizeProjectRelativePath("C:/secret/key.txt")).toThrow();
    expect(() => normalizeProjectRelativePath("/tmp/key.txt")).toThrow();
  });

  it("APIキーをローカル設定ファイルへ保存しない", () => {
    expect(
      prepareSettingsForStorage({
        apiKeys: {
          google: "real-google-key",
          openai: "real-openai-key",
          stability: "real-stability-key",
        },
        outputPreset: { width: 1280, height: 720, fps: 30 },
      })
    ).toEqual({
      apiKeys: {},
      outputPreset: { width: 1280, height: 720, fps: 30 },
    });
  });

  it("プロジェクト所有者がある場合は異なるユーザーの操作を拒否する", () => {
    expect(canAccessProject("user-a", "user-a")).toBe(true);
    expect(canAccessProject("user-a", "user-b")).toBe(false);
    expect(canAccessProject("user-a", null)).toBe(true);
    expect(canAccessProject(null, "user-b")).toBe(true);
  });
});
