import { z } from "zod";

export const ScriptLineSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  emotion: z.string().optional(),
});

export const ScriptSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
  lines: z.array(ScriptLineSchema),
});

export type Script = z.infer<typeof ScriptSchema>;

export const FileCategorySchema = z.enum(["input", "output", "intermediate", "final"]);

export const ArtifactTypeSchema = z.enum(["audio", "subtitle", "image", "video"]);

const BaseArtifactMetadataSchema = z.object({
  type: ArtifactTypeSchema,
  relativePath: z.string(),
  fileCategory: FileCategorySchema.optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
});

export const AudioMetadataSchema = BaseArtifactMetadataSchema.extend({
  type: z.literal("audio"),
  durationMs: z.number().nonnegative().optional(),
  sampleRateHz: z.number().int().positive().optional(),
  channels: z.number().int().positive().optional(),
});

export const SubtitleMetadataSchema = BaseArtifactMetadataSchema.extend({
  type: z.literal("subtitle"),
  format: z.enum(["ass", "srt", "vtt", "json"]).optional(),
  language: z.string().optional(),
  lineCount: z.number().int().nonnegative().optional(),
});

export const ImageMetadataSchema = BaseArtifactMetadataSchema.extend({
  type: z.literal("image"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const VideoMetadataSchema = BaseArtifactMetadataSchema.extend({
  type: z.literal("video"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().nonnegative().optional(),
  frameRate: z.number().positive().optional(),
});

export const ArtifactMetadataSchema = z.discriminatedUnion("type", [
  AudioMetadataSchema,
  SubtitleMetadataSchema,
  ImageMetadataSchema,
  VideoMetadataSchema,
]);

export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

