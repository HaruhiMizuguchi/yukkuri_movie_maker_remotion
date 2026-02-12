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

export const ArtifactTypeSchema = z.enum([
  "audio",
  "subtitle",
  "image",
  "video",
  "script",
  "metadata",
]);

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

export const ScriptMetadataSchema = BaseArtifactMetadataSchema.extend({
  type: z.literal("script"),
  lineCount: z.number().int().nonnegative().optional(),
  language: z.string().optional(),
});

export const GenericMetadataSchema = BaseArtifactMetadataSchema.extend({
  type: z.literal("metadata"),
  kind: z.string().optional(),
});

export const ArtifactMetadataSchema = z.discriminatedUnion("type", [
  AudioMetadataSchema,
  SubtitleMetadataSchema,
  ImageMetadataSchema,
  VideoMetadataSchema,
  ScriptMetadataSchema,
  GenericMetadataSchema,
]);

export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

// Workflow/job lifecycle status shared across packages.
export const JobStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

// Input payload for a single workflow step execution.
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

// Output payload produced by a single workflow step execution.
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

// Input payload for a workflow run request.
export const WorkflowInputSchema = z.object({
  jobId: z.string(),
  projectId: z.string().optional(),
  mode: z.string().optional(),
  initialArtifacts: z.array(ArtifactMetadataSchema).optional(),
  parameters: z.record(z.unknown()).optional(),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

// Output payload describing the result of a workflow run.
export const WorkflowOutputSchema = z.object({
  jobId: z.string(),
  status: JobStatusSchema,
  steps: z.array(WorkflowStepOutputSchema).optional(),
  artifacts: z.array(ArtifactMetadataSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;

export const TimelineTrackTypeSchema = z.enum([
  "audio",
  "subtitle",
  "image",
  "video",
  "character",
  "bgm",
]);

export const TimelineClipSchema = z.object({
  id: z.string(),
  assetType: ArtifactTypeSchema,
  assetPath: z.string(),
  startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  inMs: z.number().int().nonnegative().optional(),
  outMs: z.number().int().nonnegative().optional(),
  volume: z.number().min(0).max(2).optional(),
  fadeInMs: z.number().int().nonnegative().optional(),
  fadeOutMs: z.number().int().nonnegative().optional(),
  text: z.string().optional(),
  style: z.string().optional(),
});

export const TimelineTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: TimelineTrackTypeSchema,
  clips: z.array(TimelineClipSchema),
});

export const TimelineMarkerSchema = z.object({
  id: z.string(),
  timeMs: z.number().int().nonnegative(),
  label: z.string(),
});

export const TimelinePlaybackRangeSchema = z.object({
  inMs: z.number().int().nonnegative(),
  outMs: z.number().int().nonnegative(),
});

export const TimelineDataSchema = z.object({
  playbackRange: TimelinePlaybackRangeSchema,
  tracks: z.array(TimelineTrackSchema),
  markers: z.array(TimelineMarkerSchema),
});

export type TimelineClip = z.infer<typeof TimelineClipSchema>;
export type TimelineTrack = z.infer<typeof TimelineTrackSchema>;
export type TimelineMarker = z.infer<typeof TimelineMarkerSchema>;
export type TimelinePlaybackRange = z.infer<typeof TimelinePlaybackRangeSchema>;
export type TimelineData = z.infer<typeof TimelineDataSchema>;

