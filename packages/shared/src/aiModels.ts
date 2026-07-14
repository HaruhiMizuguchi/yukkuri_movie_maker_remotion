import { z } from "zod";

export const SCRIPT_GENERATION_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
] as const;

export const IMAGE_GENERATION_MODELS = [
  "gemini-3.1-flash-lite-image",
  "gemini-3.1-flash-image",
] as const;

export const ScriptGenerationModelSchema = z.enum(SCRIPT_GENERATION_MODELS);
export const ImageGenerationModelSchema = z.enum(IMAGE_GENERATION_MODELS);

export type ScriptGenerationModel = z.infer<typeof ScriptGenerationModelSchema>;
export type ImageGenerationModel = z.infer<typeof ImageGenerationModelSchema>;

export const DEFAULT_SCRIPT_MODEL: ScriptGenerationModel = "gemini-3.5-flash";
export const DEFAULT_IMAGE_MODEL: ImageGenerationModel =
  "gemini-3.1-flash-lite-image";

export const SCRIPT_MODEL_OPTIONS: ReadonlyArray<{
  id: ScriptGenerationModel;
  label: string;
  description: string;
}> = [
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash（高品質）",
    description: "台本の構成力を優先する現在の標準モデルです。",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview（バランス）",
    description: "品質と費用のバランスを取りたい場合に向いています。",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite（低料金）",
    description: "簡潔な台本を低料金で多数作る場合に向いています。",
  },
];

export const IMAGE_MODEL_OPTIONS: ReadonlyArray<{
  id: ImageGenerationModel;
  label: string;
  description: string;
}> = [
  {
    id: "gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite（おすすめ）",
    description: "1K画像を高速・低料金で生成します。",
  },
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2（高品質）",
    description: "構図や文字表現の品質を優先します。",
  },
];
