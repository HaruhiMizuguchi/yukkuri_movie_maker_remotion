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

export const JobStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const WorkflowStepInputSchema = z.object({
  jobId: z.string(),
  projectId: z.string().optional(),
  stepName: z.string(),
  mode: z.string().optional(),
  artifacts: z.array(ArtifactMetadataSchema).optional(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkflowStepInput = z.infer<typeof WorkflowStepInputSchema>;

export const WorkflowStepOutputSchema = z.object({
  stepName: z.string(),
  ok: z.boolean(),
  skipped: z.boolean().optional(),
  reason: z.string().optional(),
  artifacts: z.array(ArtifactMetadataSchema).optional(),
  output: z.record(z.unknown()).optional(),
  warnings: z.array(z.string()).optional(),
});

export type WorkflowStepOutput = z.infer<typeof WorkflowStepOutputSchema>;

export const WorkflowInputSchema = z.object({
  jobId: z.string(),
  projectId: z.string().optional(),
  mode: z.string().optional(),
  initialArtifacts: z.array(ArtifactMetadataSchema).optional(),
  parameters: z.record(z.unknown()).optional(),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

export const WorkflowOutputSchema = z.object({
  jobId: z.string(),
  status: JobStatusSchema,
  steps: z.array(WorkflowStepOutputSchema).optional(),
  artifacts: z.array(ArtifactMetadataSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;

