import { describe, expect, it } from "vitest";
import {
  buildSafeAssetFilename,
  canAccessProject,
  normalizeAssetRelativePath,
  normalizeProjectRelativePath,
  normalizeTemplateId,
  parseCreateJobBody,
  prepareSettingsForStorage,
  readByteRange,
  resolveSafeChildPath,
  resolveWorkflowJobRequest,
} from "./apiValidation";

describe("api validation", () => {
  it("skipStepsを既知のワークフローステップだけに制限する", () => {
    expect(
      parseCreateJobBody({
        mode: "full",
        runMode: "resume",
        skipSteps: ["tts_generation", "subtitle_generation"],
      }),
    ).toEqual({
      mode: "full",
      runMode: "resume",
      skipSteps: ["tts_generation", "subtitle_generation"],
    });

    expect(() =>
      parseCreateJobBody({ skipSteps: ["../../not-a-step"] }),
    ).toThrow();
  });

  it("生成モードを実行ステップ計画へ変換する", () => {
    expect(resolveWorkflowJobRequest({ mode: "full" })).toEqual({
      mode: "full",
      runMode: undefined,
      skipSteps: undefined,
    });

    expect(resolveWorkflowJobRequest({ mode: "scriptOnly" }).skipSteps).toEqual(
      [
        "tts_generation",
        "audio_enhancement",
        "character_synthesis",
        "background_generation",
        "background_animation",
        "illustration_insertion",
        "subtitle_generation",
        "video_composition",
        "final_encoding",
        "youtube_upload",
      ],
    );

    expect(resolveWorkflowJobRequest({ mode: "renderOnly" }).skipSteps).toEqual(
      [
        "theme_selection",
        "script_generation",
        "title_generation",
        "youtube_upload",
      ],
    );

    expect(
      resolveWorkflowJobRequest({
        mode: "custom",
        skipSteps: [
          "subtitle_generation",
          "subtitle_generation",
          "youtube_upload",
        ],
      }).skipSteps,
    ).toEqual(["subtitle_generation", "youtube_upload"]);
  });

  it("アップロード保存用ファイル名のパストラバーサルを拒否する", () => {
    expect(buildSafeAssetFilename("asset-1", "png")).toBe("asset-1.png");
    expect(buildSafeAssetFilename("asset_2", ".jpg")).toBe("asset_2.jpg");

    expect(() => buildSafeAssetFilename("../asset", "png")).toThrow();
    expect(() => buildSafeAssetFilename("asset", "../png")).toThrow();
    expect(() => buildSafeAssetFilename("asset/name", "png")).toThrow();
  });

  it("既存素材参照の相対パスをプロジェクト内参照に制限する", () => {
    expect(normalizeProjectRelativePath("input/assets/bg.png")).toBe(
      "input/assets/bg.png",
    );
    expect(normalizeProjectRelativePath("input\\assets\\bg.png")).toBe(
      "input/assets/bg.png",
    );

    expect(() => normalizeProjectRelativePath("../.env")).toThrow();
    expect(() => normalizeProjectRelativePath("C:/secret/key.txt")).toThrow();
    expect(() => normalizeProjectRelativePath("/tmp/key.txt")).toThrow();
  });

  it("素材参照を対象プロジェクトまたは共有素材領域だけに制限する", () => {
    const projectId = "11111111-1111-1111-1111-111111111111";
    expect(
      normalizeAssetRelativePath(
        projectId,
        `projects/${projectId}/input/assets/backgrounds/bg.png`,
      ),
    ).toBe(`projects/${projectId}/input/assets/backgrounds/bg.png`);
    expect(
      normalizeAssetRelativePath(projectId, "input/assets/backgrounds/bg.png"),
    ).toBe(`projects/${projectId}/input/assets/backgrounds/bg.png`);
    expect(normalizeAssetRelativePath(projectId, "assets/shared/bg.png")).toBe(
      "assets/shared/bg.png",
    );

    expect(() => normalizeAssetRelativePath(projectId, ".env")).toThrow();
    expect(() =>
      normalizeAssetRelativePath(
        projectId,
        "projects/22222222-2222-2222-2222-222222222222/input/assets/secret.png",
      ),
    ).toThrow();
  });

  it("テンプレートIDを安全なファイル名トークンに制限する", () => {
    expect(normalizeTemplateId("news-template_01")).toBe("news-template_01");
    expect(() => normalizeTemplateId("../../../package")).toThrow();
    expect(() => normalizeTemplateId("template/name")).toThrow();
  });

  it("成果物配信パスを指定ルート配下に制限する", () => {
    const root = "C:/workspace/output-root";
    expect(resolveSafeChildPath(root, "projects/p1/final/final.mp4")).toContain(
      "projects",
    );
    expect(() => resolveSafeChildPath(root, "../.env")).toThrow();
    expect(() => resolveSafeChildPath(root, "C:/secret/key.txt")).toThrow();
  });

  it("動画配信用Rangeヘッダーを安全に解釈する", () => {
    expect(readByteRange(undefined, 1000)).toBeNull();
    expect(readByteRange("bytes=100-199", 1000)).toEqual({
      start: 100,
      end: 199,
    });
    expect(readByteRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(readByteRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(readByteRange("bytes=1000-1200", 1000)).toBe("invalid");
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
      }),
    ).toEqual({
      apiKeys: {},
      outputPreset: { width: 1280, height: 720, fps: 30 },
    });
  });

  it("プロジェクト所有者がある場合は異なるユーザーの操作を拒否する", () => {
    expect(canAccessProject("user-a", "user-a")).toBe(true);
    expect(canAccessProject("user-a", "user-b")).toBe(false);
    expect(canAccessProject("user-a", null)).toBe(false);
    expect(canAccessProject(null, "user-b")).toBe(false);
  });
});
