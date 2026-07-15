import { z } from "zod";

export const AiProviderSchema = z.enum(["google", "openai", "anthropic"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const SCRIPT_GENERATION_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "claude-fable-5",
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-haiku-4-5",
] as const;

export const IMAGE_GENERATION_MODELS = [
  "gemini-3.1-flash-lite-image",
  "gemini-3.1-flash-image",
  "gpt-image-2",
] as const;

export const ScriptGenerationModelSchema = z.enum(SCRIPT_GENERATION_MODELS);
export const ImageGenerationModelSchema = z.enum(IMAGE_GENERATION_MODELS);

export type ScriptGenerationModel = z.infer<typeof ScriptGenerationModelSchema>;
export type ImageGenerationModel = z.infer<typeof ImageGenerationModelSchema>;

export const DEFAULT_SCRIPT_MODEL: ScriptGenerationModel = "gemini-3.5-flash";
export const DEFAULT_IMAGE_MODEL: ImageGenerationModel =
  "gemini-3.1-flash-lite-image";

export const inferAiProviderFromModel = (model: string): AiProvider => {
  if (model.startsWith("gpt-")) return "openai";
  if (model.startsWith("claude-")) return "anthropic";
  return "google";
};

export const getAiProviderForScriptModel = (
  model: ScriptGenerationModel,
): AiProvider => inferAiProviderFromModel(model);

export const getAiProviderForImageModel = (
  model: ImageGenerationModel,
): Exclude<AiProvider, "anthropic"> =>
  inferAiProviderFromModel(model) === "openai" ? "openai" : "google";

export const SCRIPT_MODEL_OPTIONS: ReadonlyArray<{
  id: ScriptGenerationModel;
  provider: AiProvider;
  label: string;
  description: string;
}> = [
  {
    id: "gemini-3.5-flash",
    provider: "google",
    label: "Gemini 3.5 Flash（高品質）",
    description: "台本の構成力を優先する現在の標準モデルです。",
  },
  {
    id: "gemini-3-flash-preview",
    provider: "google",
    label: "Gemini 3 Flash Preview（バランス）",
    description: "品質と費用のバランスを取りたい場合に向いています。",
  },
  {
    id: "gemini-3.1-flash-lite",
    provider: "google",
    label: "Gemini 3.1 Flash-Lite（低料金）",
    description: "簡潔な台本を低料金で多数作る場合に向いています。",
  },
  {
    id: "gpt-5.6-sol",
    provider: "openai",
    label: "OpenAI GPT-5.6 Sol（最高品質）",
    description: "複雑な構成と表現品質を優先するOpenAIの高性能モデルです。",
  },
  {
    id: "gpt-5.6-terra",
    provider: "openai",
    label: "OpenAI GPT-5.6 Terra（おすすめ）",
    description: "台本品質・速度・料金のバランスを取りたい場合に向いています。",
  },
  {
    id: "gpt-5.6-luna",
    provider: "openai",
    label: "OpenAI GPT-5.6 Luna（低料金）",
    description: "大量の台本をOpenAIで低料金に生成する場合に向いています。",
  },
  {
    id: "claude-fable-5",
    provider: "anthropic",
    label: "Claude Fable 5（最高品質）",
    description: "長い構成や複雑な企画を高品質にまとめるClaudeモデルです。",
  },
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    label: "Claude Opus 4.8（高品質）",
    description: "複雑な推論と文章品質を重視する場合に向いています。",
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5（おすすめ）",
    description: "速度・文章品質・料金のバランスを取りたい場合に向いています。",
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Claude Haiku 4.5（低料金）",
    description: "短い台本を高速・低料金で生成する場合に向いています。",
  },
];

export const IMAGE_MODEL_OPTIONS: ReadonlyArray<{
  id: ImageGenerationModel;
  provider: Exclude<AiProvider, "anthropic">;
  label: string;
  description: string;
}> = [
  {
    id: "gemini-3.1-flash-lite-image",
    provider: "google",
    label: "Nano Banana 2 Lite（おすすめ）",
    description: "1K画像を高速・低料金で生成します。",
  },
  {
    id: "gemini-3.1-flash-image",
    provider: "google",
    label: "Nano Banana 2（高品質）",
    description: "構図や文字表現の品質を優先します。",
  },
  {
    id: "gpt-image-2",
    provider: "openai",
    label: "OpenAI GPT Image 2（高品質）",
    description: "16:9の中品質画像をOpenAI Image APIで生成します。",
  },
];
