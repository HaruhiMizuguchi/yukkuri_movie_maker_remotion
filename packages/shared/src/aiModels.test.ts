import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SCRIPT_MODEL,
  getAiProviderForImageModel,
  getAiProviderForScriptModel,
  ImageGenerationModelSchema,
  IMAGE_GENERATION_MODELS,
  ScriptGenerationModelSchema,
  SCRIPT_GENERATION_MODELS,
} from "./aiModels";

describe("AIモデル設定", () => {
  it("現行の既定モデルを選択肢として受理する", () => {
    expect(ScriptGenerationModelSchema.parse(DEFAULT_SCRIPT_MODEL)).toBe(
      "gemini-3.5-flash",
    );
    expect(ImageGenerationModelSchema.parse(DEFAULT_IMAGE_MODEL)).toBe(
      "gemini-3.1-flash-lite-image",
    );
  });

  it("任意文字列や廃止済みモデルを設定値として受理しない", () => {
    expect(() => ScriptGenerationModelSchema.parse("gemini-unknown")).toThrow();
    expect(() =>
      ImageGenerationModelSchema.parse("imagen-4.0-generate-001"),
    ).toThrow();
  });

  it("OpenAIとClaudeの現行モデルを選択肢として受理する", () => {
    expect(SCRIPT_GENERATION_MODELS).toContain("gpt-5.6-terra");
    expect(SCRIPT_GENERATION_MODELS).toContain("claude-sonnet-5");
    expect(IMAGE_GENERATION_MODELS).toContain("gpt-image-2");
    expect(ScriptGenerationModelSchema.parse("gpt-5.6-luna")).toBe(
      "gpt-5.6-luna",
    );
    expect(ScriptGenerationModelSchema.parse("claude-haiku-4-5")).toBe(
      "claude-haiku-4-5",
    );
  });

  it("モデルから必要なAPIプロバイダーを一意に判定する", () => {
    expect(getAiProviderForScriptModel("gemini-3.5-flash")).toBe("google");
    expect(getAiProviderForScriptModel("gpt-5.6-terra")).toBe("openai");
    expect(getAiProviderForScriptModel("claude-sonnet-5")).toBe("anthropic");
    expect(getAiProviderForImageModel("gpt-image-2")).toBe("openai");
  });
});
