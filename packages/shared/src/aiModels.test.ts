import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SCRIPT_MODEL,
  ImageGenerationModelSchema,
  ScriptGenerationModelSchema,
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
});
