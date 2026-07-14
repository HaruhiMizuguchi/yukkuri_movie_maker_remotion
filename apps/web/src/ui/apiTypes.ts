import type { AutomationMode, WorkflowStepName } from "./automationProfiles";
import type { TimelineData, TimelineMarker } from "./timelineEditor";

export type DashboardStats = {
  projectCount: number;
  runningJobCount: number;
  failedJobCount: number;
};

export type ProjectSummary = {
  id: string;
  theme: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  latestJob: {
    id: string;
    status: string;
    mode: string;
    createdAt: string;
  } | null;
};

export type ScriptLine = { speaker: string; text: string; emotion?: string };

export type ScriptData = {
  title?: string;
  theme?: string;
  lines: ScriptLine[];
};

export type ProjectAsset = {
  id: string;
  type: string;
  name: string;
  relativePath: string;
  usage?: string;
  createdAt: string;
};

export type AppSettings = {
  apiKeys: { google?: string; openai?: string; stability?: string };
  outputPreset: { width: number; height: number; fps: number };
};

export type AiUsageSummary = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
  estimatedCostUsd: number;
  estimatedCostJpy: number;
  unpricedRequestCount: number;
  usdJpyRate: number;
  pricingVersion: string;
  pricingSource: string;
  byModel: Array<{
    provider: string;
    kind: "llm" | "image";
    model: string;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    imageCount: number;
    estimatedCostUsd: number;
    unpricedRequestCount: number;
  }>;
};

export type ProjectDetail = {
  project: {
    id: string;
    theme: string | null;
    status: string;
    automationMode: AutomationMode;
    settingsJson?: AppSettings;
  };
  jobs: Array<{
    id: string;
    status: string;
    mode: string;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    error?: string | null;
    steps: Array<{ stepName: string; status: string; completedAt?: string }>;
    files: Array<{
      id: string;
      relativePath: string;
      fileType: string;
      fileCategory: string;
    }>;
  }>;
  script: ScriptData | null;
  timeline: TimelineData | null;
  assets: ProjectAsset[];
  aiUsageSummary: {
    project: AiUsageSummary;
    latestJob: AiUsageSummary | null;
  };
  logs: string[];
};

export type Template = {
  id: string;
  name: string;
  description?: string;
  automationProfile?: { mode: AutomationMode; skipSteps?: WorkflowStepName[] };
};

export type PreviewResponse = {
  outputPreset?: { width: number; height: number; fps: number };
  remotionProps: {
    durationInFrames: number;
    durationMs: number;
    subtitleTracks: Array<{ text: string; startMs: number; endMs: number }>;
    audioTracks: Array<{ clipId: string; startMs: number; endMs: number }>;
    markers: TimelineMarker[];
    manualEditSummary: {
      subtitleClipCount: number;
      audioClipCount: number;
      markerCount: number;
      playbackRangeApplied: boolean;
    };
  };
};

export type SettingsDiagnostics = {
  googleApiKey: { configured: boolean };
  aivisSpeech: {
    configured: boolean;
    reachable: boolean;
    status?: number;
    error?: string;
  };
};
