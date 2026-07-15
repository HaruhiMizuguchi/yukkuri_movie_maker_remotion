import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SCRIPT_MODEL,
  IMAGE_MODEL_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  type AiProvider,
} from "@ymm/shared";
import { fetchJson } from "./apiClient";
import type {
  AppSettings,
  DashboardStats,
  PreviewResponse,
  ProjectAsset,
  ProjectDetail,
  ProjectSummary,
  ScriptData,
  SecretSettingsStatus,
  SettingsDiagnostics,
  Template,
} from "./apiTypes";
import {
  automationModeDescriptions,
  automationModeLabels,
  buildJobRequest,
  workflowStepLabels,
  workflowSteps,
  type AutomationMode,
  type WorkflowStepName,
} from "./automationProfiles";
import {
  getRecommendedAction,
  getWorkflowPosition,
  primaryWorkflowNavigation,
} from "./guidedWorkflow";
import { getGenerationProgress } from "./generationProgress";
import type { ScreenId } from "./screenConfig";
import { styleText, styles } from "./styles";
import {
  addManualSubtitleClipLocal,
  addTimelineMarkerLocal,
  clampNonNegativeInt,
  deleteTimelineClipLocal,
  duplicateTimelineClipLocal,
  findTimelineClip,
  formatTimelineTime,
  getTimelineTickStepMs,
  getTimelineViewport,
  getTrackAccent,
  getVisibleClipLayout,
  predictNextDuplicateClipId,
  predictNextSplitClipId,
  splitTimelineClipLocal,
  summarizeTimelineDraft,
  updateTimelineClipLocal,
  type SelectedTimelineClip,
  type TimelineData,
} from "./timelineEditor";

const initialScript: ScriptData = {
  title: "",
  theme: "",
  lines: [
    { speaker: "reimu", text: "" },
    { speaker: "marisa", text: "" },
  ],
};

const statusLabels: Record<string, string> = {
  PENDING: "待機中",
  RUNNING: "実行中",
  COMPLETED: "完了",
  FAILED: "失敗",
  CANCELLED: "キャンセル",
  SKIPPED: "スキップ",
};

const formatStatus = (status: string): string => statusLabels[status] ?? status;

const assetTypeLabels: Record<string, string> = {
  image: "画像",
  audio: "音声",
  video: "動画",
  subtitle: "字幕",
};

const assetUsageLabels: Record<string, string> = {
  background: "背景",
  character: "立ち絵",
  bgm: "BGM",
  se: "効果音",
  reference: "参考素材",
  other: "その他",
};

const buildJobFileUrl = (jobId: string, fileId: string) =>
  `/api/jobs/${jobId}/files/${fileId}`;

const projectRequiredScreens = new Set<ScreenId>([
  "script",
  "assets",
  "timeline",
  "preview",
  "project",
]);

const formatUpdatedAt = (value: string): string =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatTokenCount = (value: number): string =>
  new Intl.NumberFormat("ja-JP").format(value);

const formatEstimatedJpy = (value: number): string =>
  "約 " +
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);

const formatEstimatedUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);

type ApiKeyStatusField = "googleApiKey" | "openaiApiKey" | "anthropicApiKey";

const apiProviderSettings: ReadonlyArray<{
  id: AiProvider;
  statusField: ApiKeyStatusField;
  title: string;
  description: string;
  placeholder: string;
}> = [
  {
    id: "google",
    statusField: "googleApiKey",
    title: "Google Gemini",
    description: "Geminiの台本生成と画像生成に使います。",
    placeholder: "Google AI Studioで発行したキー",
  },
  {
    id: "openai",
    statusField: "openaiApiKey",
    title: "OpenAI",
    description: "GPTの台本生成とGPT Imageの画像生成に使います。",
    placeholder: "OpenAI Platformで発行したキー",
  },
  {
    id: "anthropic",
    statusField: "anthropicApiKey",
    title: "Anthropic Claude",
    description: "Claudeの台本生成に使います。画像生成には対応しません。",
    placeholder: "Claude Consoleで発行したキー",
  },
];

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("dashboard");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    projectCount: 0,
    runningJobCount: 0,
    failedJobCount: 0,
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(
    null,
  );
  const [scriptDraft, setScriptDraft] = useState<ScriptData>(initialScript);
  const [timelineDraft, setTimelineDraft] = useState<TimelineData | null>(null);
  const [timelinePast, setTimelinePast] = useState<TimelineData[]>([]);
  const [timelineFuture, setTimelineFuture] = useState<TimelineData[]>([]);
  const [timelineDirty, setTimelineDirty] = useState(false);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [assetForm, setAssetForm] = useState({
    type: "image",
    usage: "background",
    name: "",
    relativePath: "",
  });
  const [assetUploadFile, setAssetUploadFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    models: {
      script: DEFAULT_SCRIPT_MODEL,
      image: DEFAULT_IMAGE_MODEL,
    },
    outputPreset: { width: 1920, height: 1080, fps: 30 },
  });
  const [secretSettingsStatus, setSecretSettingsStatus] =
    useState<SecretSettingsStatus | null>(null);
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<AiProvider, string>>({
    google: "",
    openai: "",
    anthropic: "",
  });
  const [settingsDiagnostics, setSettingsDiagnostics] =
    useState<SettingsDiagnostics | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [wizardTheme, setWizardTheme] = useState("ゆっくり解説");
  const [wizardMode, setWizardMode] = useState<AutomationMode>("full");
  const [customSkipSteps, setCustomSkipSteps] = useState<WorkflowStepName[]>(
    [],
  );
  const [wizardTemplateId, setWizardTemplateId] = useState("");
  const [manualSubtitleText, setManualSubtitleText] = useState("");
  const [manualMarkerLabel, setManualMarkerLabel] = useState("調整ポイント");
  const [manualMarkerTimeMs, setManualMarkerTimeMs] = useState("0");
  const [selectedTimelineClip, setSelectedTimelineClip] =
    useState<SelectedTimelineClip | null>(null);
  const [timelinePlayheadMs, setTimelinePlayheadMs] = useState(0);
  const [timelineZoomWindowMs, setTimelineZoomWindowMs] = useState(6000);
  const [message, setMessage] = useState("");
  const [lastCreatedJobId, setLastCreatedJobId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedClipDetail = useMemo(
    () => findTimelineClip(timelineDraft, selectedTimelineClip),
    [selectedTimelineClip, timelineDraft],
  );
  const latestPreviewJob =
    projectDetail?.jobs.find((job) =>
      job.files.some(
        (file) =>
          file.fileType === "video" &&
          file.relativePath.endsWith("preview.mp4"),
      ),
    ) ?? null;
  const latestFinalJob =
    projectDetail?.jobs.find((job) =>
      job.files.some(
        (file) => file.fileType === "video" && file.fileCategory === "final",
      ),
    ) ?? null;
  const previewFile = useMemo(
    () =>
      latestPreviewJob?.files.find(
        (file) =>
          file.fileType === "video" &&
          file.relativePath.endsWith("preview.mp4"),
      ) ?? null,
    [latestPreviewJob],
  );
  const finalFile = useMemo(
    () =>
      latestFinalJob?.files.find(
        (file) => file.fileType === "video" && file.fileCategory === "final",
      ) ?? null,
    [latestFinalJob],
  );
  const previewVideoUrl =
    latestPreviewJob && previewFile
      ? buildJobFileUrl(latestPreviewJob.id, previewFile.id)
      : null;
  const finalVideoUrl =
    latestFinalJob && finalFile
      ? `${buildJobFileUrl(latestFinalJob.id, finalFile.id)}?download=1`
      : null;
  const hasRunningJob = Boolean(
    projectDetail?.jobs.some((job) =>
      ["PENDING", "RUNNING"].includes(job.status),
    ),
  );
  const generationMonitor = projectDetail?.jobs[0]
    ? getGenerationProgress(projectDetail.jobs[0])
    : null;
  const recommendedAction = getRecommendedAction({
    hasProject: Boolean(selectedProjectId),
    hasScript: Boolean(
      projectDetail?.script?.lines.some((line) => line.text.trim()),
    ),
    hasFinalVideo: Boolean(finalVideoUrl),
    hasRunningJob,
  });
  const workflowPosition = getWorkflowPosition(activeScreen);
  const getApiStatusLabel = (statusField: ApiKeyStatusField): string => {
    const diagnostics = settingsDiagnostics?.[statusField];
    if (diagnostics) {
      if (diagnostics.reachable) return "接続OK";
      if (diagnostics.configured) {
        return `接続失敗${diagnostics.status ? ` (HTTP ${diagnostics.status})` : ""}`;
      }
      return "未設定";
    }
    const status = secretSettingsStatus?.[statusField];
    if (!status?.configured) return "未設定";
    return status.source === "environment" ? "環境変数で設定済み" : "保存済み";
  };

  const beginNewProject = () => {
    setSelectedProjectId(null);
    setProjectDetail(null);
    setScriptDraft({
      ...initialScript,
      lines: initialScript.lines.map((line) => ({ ...line })),
    });
    setTimelineDraft(null);
    setTimelinePast([]);
    setTimelineFuture([]);
    setTimelineDirty(false);
    setAssets([]);
    setAssetForm({
      type: "image",
      usage: "background",
      name: "",
      relativePath: "",
    });
    setAssetUploadFile(null);
    setPreview(null);
    setSelectedTimelineClip(null);
    setTimelinePlayheadMs(0);
    setTimelineZoomWindowMs(6000);
    setManualSubtitleText("");
    setManualMarkerLabel("調整ポイント");
    setManualMarkerTimeMs("0");
    setWizardTheme("");
    setWizardMode("full");
    setCustomSkipSteps([]);
    setWizardTemplateId("");
    setLastCreatedJobId(null);
    setErrorMessage("");
    retryActionRef.current = null;
    setMessage(
      "新しい動画の作成に切り替えました。以前の動画は保存されたままです。",
    );
    setActiveScreen("wizard");
  };

  const navigateToScreen = (screen: ScreenId) => {
    if (screen === "wizard") {
      beginNewProject();
      return;
    }
    if (projectRequiredScreens.has(screen) && !selectedProjectId) {
      setMessage(
        "先にホームでプロジェクトを選ぶか、新しい動画を作成してください。",
      );
      setActiveScreen("dashboard");
      return;
    }
    setActiveScreen(screen);
  };
  const timelineViewport = useMemo(
    () =>
      timelineDraft
        ? getTimelineViewport(
            timelineDraft,
            timelinePlayheadMs,
            timelineZoomWindowMs,
          )
        : null,
    [timelineDraft, timelinePlayheadMs, timelineZoomWindowMs],
  );
  const timelineTicks = useMemo(() => {
    if (!timelineViewport) {
      return [];
    }
    const tickStepMs = getTimelineTickStepMs(
      timelineViewport.viewportDurationMs,
    );
    const ticks: number[] = [];
    const startTickMs =
      Math.ceil(timelineViewport.viewportStartMs / tickStepMs) * tickStepMs;
    for (
      let tickMs = startTickMs;
      tickMs <= timelineViewport.viewportEndMs;
      tickMs += tickStepMs
    ) {
      ticks.push(tickMs);
    }
    return ticks;
  }, [timelineViewport]);

  const runUiAction = async (action: () => Promise<void>): Promise<void> => {
    setPendingActions((current) => current + 1);
    setErrorMessage("");
    try {
      await action();
      retryActionRef.current = null;
    } catch (error) {
      retryActionRef.current = action;
      const detail = error instanceof Error ? error.message : String(error);
      setErrorMessage(`操作に失敗しました: ${detail}`);
    } finally {
      setPendingActions((current) => Math.max(0, current - 1));
    }
  };

  useEffect(() => {
    void runUiAction(async () => {
      await Promise.all([
        refreshDashboard(),
        loadSettings(),
        loadSecretSettingsStatus(),
        loadTemplates(),
      ]);
    });
  }, []);

  useEffect(() => {
    if (activeScreen !== "settings") return;
    void runUiAction(async () => {
      await Promise.all([loadSettings(), loadSecretSettingsStatus()]);
    });
  }, [activeScreen, selectedProjectId]);

  useEffect(() => {
    if (
      !selectedProjectId ||
      !projectDetail?.jobs.some((job) =>
        ["PENDING", "RUNNING"].includes(job.status),
      )
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void Promise.all([
        loadProjectDetail(selectedProjectId, { preservePreview: true }),
        refreshDashboard(),
      ]).catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        setErrorMessage(`状態の自動更新に失敗しました: ${detail}`);
      });
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [projectDetail?.jobs, selectedProjectId]);

  useEffect(() => {
    if (
      selectedTimelineClip &&
      !findTimelineClip(timelineDraft, selectedTimelineClip)
    ) {
      setSelectedTimelineClip(null);
    }
    if (!timelineDraft) {
      return;
    }
    setTimelinePlayheadMs((current) =>
      Math.min(
        timelineDraft.playbackRange.outMs,
        Math.max(timelineDraft.playbackRange.inMs, current),
      ),
    );
  }, [selectedTimelineClip, timelineDraft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoTimeline();
        } else {
          undoTimeline();
        }
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redoTimeline();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timelineDraft, timelineFuture, timelinePast]);

  const refreshDashboard = async () => {
    const [projectList, stats] = await Promise.all([
      fetchJson<ProjectSummary[]>("/api/projects"),
      fetchJson<DashboardStats>("/api/dashboard"),
    ]);
    setProjects(projectList);
    setDashboardStats(stats);
  };

  const loadProjectDetail = async (
    projectId: string,
    options: { preservePreview?: boolean } = {},
  ) => {
    const detail = await fetchJson<ProjectDetail>(`/api/projects/${projectId}`);
    setSelectedProjectId(projectId);
    setProjectDetail(detail);
    setScriptDraft(detail.script ?? initialScript);
    if (!timelineDirty) {
      setTimelineDraft(detail.timeline);
      setTimelinePast([]);
      setTimelineFuture([]);
    }
    setAssets(detail.assets ?? []);
    if (detail.project.automationMode in automationModeLabels) {
      setWizardMode(detail.project.automationMode);
    }
    if (detail.project.settingsJson) {
      setSettings(detail.project.settingsJson);
    }
    if (!options.preservePreview) {
      setPreview(null);
    }
    setSelectedTimelineClip(null);
    setTimelinePlayheadMs(detail.timeline?.playbackRange.inMs ?? 0);
    setTimelineZoomWindowMs(
      Math.min(
        12000,
        Math.max(
          2400,
          (detail.timeline?.playbackRange.outMs ?? 6000) -
            (detail.timeline?.playbackRange.inMs ?? 0),
        ),
      ),
    );
  };

  const createProject = async () => {
    const created = await fetchJson<{ projectId: string }>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme: wizardTheme,
        mode: wizardMode,
        templateId: wizardTemplateId || undefined,
      }),
    });
    setMessage(
      "動画の制作を開始しました。内容を確認しながら順番に進められます。",
    );
    await refreshDashboard();
    await loadProjectDetail(created.projectId);
    setActiveScreen("project");
  };

  const createRenderJob = async () => {
    if (!selectedProjectId) return;
    const created = await fetchJson<{ jobId: string }>(
      `/api/projects/${selectedProjectId}/jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildJobRequest(wizardMode, customSkipSteps)),
      },
    );
    setLastCreatedJobId(created.jobId);
    setMessage("完成動画の生成を開始しました。進捗は自動で更新されます。");
    await loadProjectDetail(selectedProjectId, { preservePreview: true });
  };

  const createRenderJobFromStep = async (stepName: WorkflowStepName) => {
    if (!selectedProjectId) return;
    const startIndex = workflowSteps.indexOf(stepName);
    if (startIndex < 0) {
      setMessage("未知のステップは再実行できません");
      return;
    }
    const skipSteps = workflowSteps.slice(0, startIndex);
    const created = await fetchJson<{ jobId: string }>(
      `/api/projects/${selectedProjectId}/jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildJobRequest("custom", skipSteps),
          forceSteps: workflowSteps.slice(startIndex),
        }),
      },
    );
    setLastCreatedJobId(created.jobId);
    setMessage(`${workflowStepLabels[stepName]} から再生成を開始しました。`);
    await loadProjectDetail(selectedProjectId, { preservePreview: true });
  };

  const createRenderJobSkippingStep = async (stepName: WorkflowStepName) => {
    if (!selectedProjectId) return;
    if (!workflowSteps.includes(stepName)) {
      setMessage("未知のステップはスキップできません");
      return;
    }
    const created = await fetchJson<{ jobId: string }>(
      `/api/projects/${selectedProjectId}/jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildJobRequest("custom", [stepName])),
      },
    );
    setLastCreatedJobId(created.jobId);
    setMessage(
      `${workflowStepLabels[stepName]} を省略して生成を開始しました。`,
    );
    await loadProjectDetail(selectedProjectId, { preservePreview: true });
  };

  const saveScript = async () => {
    if (!selectedProjectId) return;
    await fetchJson<{ ok: boolean }>(
      `/api/projects/${selectedProjectId}/script`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scriptDraft),
      },
    );
    setMessage("台本を保存しました");
    await loadProjectDetail(selectedProjectId);
  };

  const saveScriptAndContinue = async () => {
    await saveScript();
    setActiveScreen("assets");
  };

  const addAsset = async () => {
    if (!selectedProjectId) return;
    const formData = new FormData();
    if (assetUploadFile) {
      formData.set("file", assetUploadFile);
      formData.set("type", assetForm.type);
      formData.set("usage", assetForm.usage);
      formData.set("name", assetForm.name || assetUploadFile.name || "asset");
    }
    await fetchJson(`/api/projects/${selectedProjectId}/assets`, {
      method: "POST",
      ...(assetUploadFile
        ? { body: formData }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...assetForm,
              name: assetForm.name || "asset",
            }),
          }),
    });
    setAssetForm({
      type: "image",
      usage: "background",
      name: "",
      relativePath: "",
    });
    setAssetUploadFile(null);
    const nextAssets = await fetchJson<ProjectAsset[]>(
      `/api/projects/${selectedProjectId}/assets`,
    );
    setAssets(nextAssets);
    setMessage("素材を登録しました");
  };

  const mutateTimelineDraft = (
    updater: (current: TimelineData) => TimelineData,
  ) => {
    setTimelineDraft((current) => {
      if (!current) return current;
      const updated = updater(current);
      setTimelinePast((past) => [...past.slice(-49), current]);
      setTimelineFuture([]);
      setTimelineDirty(true);
      return updated;
    });
  };

  const undoTimeline = () => {
    const previous = timelinePast.at(-1);
    if (!previous || !timelineDraft) return;
    setTimelinePast((past) => past.slice(0, -1));
    setTimelineFuture((future) => [timelineDraft, ...future].slice(0, 50));
    setTimelineDraft(previous);
    setTimelineDirty(true);
  };

  const redoTimeline = () => {
    const next = timelineFuture[0];
    if (!next || !timelineDraft) return;
    setTimelineFuture((future) => future.slice(1));
    setTimelinePast((past) => [...past.slice(-49), timelineDraft]);
    setTimelineDraft(next);
    setTimelineDirty(true);
  };

  const saveTimelineAll = async () => {
    if (!selectedProjectId || !timelineDraft) return;
    await fetchJson(`/api/projects/${selectedProjectId}/timeline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(timelineDraft),
    });
    setTimelineDirty(false);
    setTimelinePast([]);
    setTimelineFuture([]);
    setMessage("タイムラインを保存しました");
    await loadProjectDetail(selectedProjectId);
  };

  const addManualSubtitle = () => {
    const text = manualSubtitleText.trim();
    if (!text) {
      setMessage("手動テロップの本文を入力してください");
      return;
    }
    const clipId = `manual-sub-${Date.now()}`;
    mutateTimelineDraft((current) =>
      addManualSubtitleClipLocal(current, text, clipId),
    );
    setSelectedTimelineClip({ trackId: "track-subtitle", clipId });
    setManualSubtitleText("");
    setMessage(
      "手動テロップを追加しました。保存するとレンダリングに反映されます",
    );
  };

  const addTimelineMarker = () => {
    const label = manualMarkerLabel.trim();
    if (!label) {
      setMessage("マーカー名を入力してください");
      return;
    }
    mutateTimelineDraft((current) =>
      addTimelineMarkerLocal(current, {
        id: `marker-${Date.now()}`,
        timeMs: Number(manualMarkerTimeMs),
        label,
      }),
    );
    setMessage("マーカーを追加しました。保存すると反映されます");
  };

  const selectTimelineClip = (trackId: string, clipId: string) => {
    setSelectedTimelineClip({ trackId, clipId });
    const nextSelected = findTimelineClip(timelineDraft, { trackId, clipId });
    if (nextSelected) {
      setTimelinePlayheadMs(nextSelected.clip.startMs);
    }
  };

  const handleTimelineClipDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    trackId: string,
    clipId: string,
    durationMs: number,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetRatio =
      rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-ymm-timeline-clip",
      JSON.stringify({
        trackId,
        clipId,
        offsetMs: durationMs * Math.max(0, Math.min(1, offsetRatio)),
      }),
    );
  };

  const handleTimelineDrop = (
    event: React.DragEvent<HTMLDivElement>,
    destinationTrackId: string,
  ) => {
    if (!timelineViewport) return;
    event.preventDefault();
    try {
      const payload = JSON.parse(
        event.dataTransfer.getData("application/x-ymm-timeline-clip"),
      ) as { trackId: string; clipId: string; offsetMs: number };
      if (payload.trackId !== destinationTrackId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)),
      );
      const targetMs =
        timelineViewport.viewportStartMs +
        ratio * timelineViewport.viewportDurationMs -
        payload.offsetMs;
      const snappedTargetMs =
        Math.round(clampNonNegativeInt(targetMs) / 100) * 100;
      mutateTimelineDraft((current) =>
        updateTimelineClipLocal(current, payload.trackId, payload.clipId, {
          startMs: snappedTargetMs,
        }),
      );
      setTimelinePlayheadMs(snappedTargetMs);
    } catch {
      setMessage("クリップの移動データを読み取れませんでした");
    }
  };

  const splitSelectedTimelineClip = () => {
    if (!timelineDraft || !selectedTimelineClip || !selectedClipDetail) {
      setMessage("分割するクリップを選択してください");
      return;
    }
    const sourceClip = selectedClipDetail.clip;
    if (
      timelinePlayheadMs <= sourceClip.startMs + 100 ||
      timelinePlayheadMs >= sourceClip.startMs + sourceClip.durationMs - 100
    ) {
      setMessage("分割位置をクリップ内に移動してください");
      return;
    }
    const nextClipId = predictNextSplitClipId(
      selectedClipDetail.track.clips,
      sourceClip.id,
    );
    mutateTimelineDraft((current) =>
      splitTimelineClipLocal(
        current,
        selectedTimelineClip.trackId,
        selectedTimelineClip.clipId,
        timelinePlayheadMs,
      ),
    );
    setSelectedTimelineClip({
      trackId: selectedTimelineClip.trackId,
      clipId: nextClipId,
    });
    setMessage(
      "プレイヘッド位置でクリップを分割しました。保存すると反映されます",
    );
  };

  const nudgeSelectedTimelineClip = (deltaMs: number) => {
    if (!selectedTimelineClip || !selectedClipDetail) {
      setMessage("移動するクリップを選択してください");
      return;
    }
    mutateTimelineDraft((current) =>
      updateTimelineClipLocal(
        current,
        selectedTimelineClip.trackId,
        selectedTimelineClip.clipId,
        {
          startMs: selectedClipDetail.clip.startMs + deltaMs,
        },
      ),
    );
    setTimelinePlayheadMs(
      Math.max(0, selectedClipDetail.clip.startMs + deltaMs),
    );
    setMessage(
      `${deltaMs > 0 ? "後ろ" : "前"}へ ${Math.abs(deltaMs)}ms 移動しました`,
    );
  };

  const duplicateSelectedTimelineClip = () => {
    if (!selectedTimelineClip || !selectedClipDetail) {
      setMessage("複製するクリップを選択してください");
      return;
    }
    const nextClipId = predictNextDuplicateClipId(
      selectedClipDetail.track.clips,
      selectedClipDetail.clip.id,
    );
    mutateTimelineDraft((current) =>
      duplicateTimelineClipLocal(
        current,
        selectedTimelineClip.trackId,
        selectedTimelineClip.clipId,
      ),
    );
    setSelectedTimelineClip({
      trackId: selectedTimelineClip.trackId,
      clipId: nextClipId,
    });
    setMessage("選択中クリップを複製しました。保存すると反映されます");
  };

  const deleteSelectedTimelineClip = () => {
    if (!selectedTimelineClip) {
      setMessage("削除するクリップを選択してください");
      return;
    }
    if (!window.confirm("選択中のクリップを削除しますか？")) return;
    mutateTimelineDraft((current) =>
      deleteTimelineClipLocal(
        current,
        selectedTimelineClip.trackId,
        selectedTimelineClip.clipId,
      ),
    );
    setSelectedTimelineClip(null);
    setMessage("選択中クリップを削除しました。保存すると反映されます");
  };

  const loadPreview = async () => {
    if (!selectedProjectId) return;
    const body = await fetchJson<PreviewResponse>(
      `/api/projects/${selectedProjectId}/preview`,
    );
    setPreview(body);
  };

  const loadSettings = async () => {
    const loaded = await fetchJson<AppSettings>(
      selectedProjectId
        ? `/api/projects/${selectedProjectId}/settings`
        : "/api/settings",
    );
    setSettings(loaded);
  };

  const loadSettingsDiagnostics = async () => {
    const diagnostics = await fetchJson<SettingsDiagnostics>(
      "/api/settings/diagnostics",
    );
    setSettingsDiagnostics(diagnostics);
    setMessage("接続状態を確認しました");
  };

  const loadSecretSettingsStatus = async () => {
    const status = await fetchJson<SecretSettingsStatus>(
      "/api/settings/secrets",
    );
    setSecretSettingsStatus(status);
  };

  const saveProviderApiKey = async (provider: AiProvider) => {
    const response = await fetchJson<SecretSettingsStatus & { ok: boolean }>(
      `/api/settings/secrets/${provider}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyDrafts[provider] }),
      },
    );
    setSecretSettingsStatus({
      googleApiKey: response.googleApiKey,
      openaiApiKey: response.openaiApiKey,
      anthropicApiKey: response.anthropicApiKey,
    });
    setApiKeyDrafts((current) => ({ ...current, [provider]: "" }));
    setSettingsDiagnostics(null);
    const title = apiProviderSettings.find(
      (item) => item.id === provider,
    )?.title;
    setMessage(
      `${title ?? provider} APIキーを安全なローカル領域へ保存しました`,
    );
  };

  const clearProviderApiKey = async (provider: AiProvider) => {
    const title = apiProviderSettings.find(
      (item) => item.id === provider,
    )?.title;
    if (!window.confirm(`保存した${title ?? provider} APIキーを削除しますか？`))
      return;
    const response = await fetchJson<SecretSettingsStatus & { ok: boolean }>(
      `/api/settings/secrets/${provider}`,
      { method: "DELETE" },
    );
    setSecretSettingsStatus({
      googleApiKey: response.googleApiKey,
      openaiApiKey: response.openaiApiKey,
      anthropicApiKey: response.anthropicApiKey,
    });
    setSettingsDiagnostics(null);
    setMessage(`保存した${title ?? provider} APIキーを削除しました`);
  };

  const saveSettings = async () => {
    await fetchJson(
      selectedProjectId
        ? `/api/projects/${selectedProjectId}/settings`
        : "/api/settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: settings.models,
          outputPreset: settings.outputPreset,
        }),
      },
    );
    setMessage("設定を保存しました");
  };

  const loadTemplates = async () => {
    const loaded = await fetchJson<Template[]>("/api/templates");
    setTemplates(loaded);
  };

  const createTemplateFromCurrent = async () => {
    if (!timelineDraft) return;
    const templateId = `template-${Date.now()}`;
    await fetchJson(`/api/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: templateId,
        sourceProjectId: selectedProjectId,
        name: `${scriptDraft.title || "新規"} テンプレート`,
        description: "Web GUIから作成",
        scriptSeed: { theme: scriptDraft.theme || wizardTheme },
        timelinePreset: timelineDraft,
        assets,
        outputPreset: settings.outputPreset,
        automationProfile: {
          mode: wizardMode,
          skipSteps: wizardMode === "custom" ? customSkipSteps : undefined,
        },
      }),
    });
    await loadTemplates();
    setMessage("現在の設定をテンプレートとして保存しました。");
  };

  return (
    <div style={styles.page}>
      <style>{styleText}</style>
      <div style={styles.backgroundShapeOne} />
      <div style={styles.backgroundShapeTwo} />
      <div style={styles.shell}>
        <header style={styles.header}>
          <button
            style={styles.brandButton}
            onClick={() => navigateToScreen("dashboard")}
            aria-label="ホームへ戻る"
          >
            <span style={styles.brandMark} aria-hidden="true">
              ゆ
            </span>
            <span>
              <span style={styles.kicker}>Yukkuri Movie Maker</span>
              <span style={styles.title}>ゆっくり動画スタジオ</span>
              <span style={styles.brandDescription}>
                テーマから完成動画まで、順番に進める制作ツール
              </span>
            </span>
          </button>
          {selectedProject ? (
            <button
              style={styles.statusCard}
              data-testid="nav-project"
              data-project-id={selectedProject.id}
              onClick={() => navigateToScreen("project")}
            >
              <span style={styles.statusCardLabel}>編集中の動画</span>
              <strong
                data-testid="selected-project-id"
                data-project-id={selectedProject.id}
              >
                {selectedProject.theme ?? "テーマ未設定"}
              </strong>
              <small>
                {formatStatus(
                  selectedProject.latestJob?.status ?? selectedProject.status,
                )}{" "}
                · 詳細を見る →
              </small>
            </button>
          ) : activeScreen === "wizard" ? (
            <div style={styles.statusCard} data-testid="selected-project-id">
              <span style={styles.statusCardLabel}>作成モード</span>
              <strong>新しい動画を作成中</strong>
              <small>以前の動画は選択されていません</small>
            </div>
          ) : (
            <div style={styles.statusCard} data-testid="selected-project-id">
              <span style={styles.statusCardLabel}>編集中の動画</span>
              <strong>まだ選ばれていません</strong>
              <small>ホームから選ぶか、新しく作成してください</small>
            </div>
          )}
        </header>

        <nav
          style={styles.navBar}
          className="main-navigation"
          aria-label="制作ナビゲーション"
        >
          <button
            data-testid="nav-dashboard"
            onClick={() => navigateToScreen("dashboard")}
            className={
              activeScreen === "dashboard" ? "home-tab-active" : "home-tab"
            }
          >
            ホーム
          </button>
          <div style={styles.stageNavigation} className="stage-navigation">
            {primaryWorkflowNavigation.map((item) => {
              const locked = Boolean(
                item.step && item.step > 1 && !selectedProjectId,
              );
              return (
                <button
                  key={item.screen}
                  data-testid={`nav-${item.screen}`}
                  onClick={() => navigateToScreen(item.screen)}
                  disabled={locked}
                  title={
                    locked
                      ? "先にプロジェクトを作成または選択してください"
                      : item.description
                  }
                  className={
                    item.screen === activeScreen
                      ? "stage-tab-active"
                      : "stage-tab"
                  }
                >
                  <span className="stage-number">{item.step}</span>
                  <span className="stage-copy">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            data-testid="nav-settings"
            onClick={() => navigateToScreen("settings")}
            className={
              activeScreen === "settings" ? "home-tab-active" : "home-tab"
            }
          >
            設定
          </button>
        </nav>

        {workflowPosition ? (
          <div style={styles.currentStepBar}>
            <span>制作ステップ {workflowPosition} / 5</span>
            <strong>
              {primaryWorkflowNavigation[workflowPosition - 1]?.label}
            </strong>
            <span>
              {primaryWorkflowNavigation[workflowPosition - 1]?.description}
            </span>
          </div>
        ) : null}

        {generationMonitor && selectedProject ? (
          <aside
            style={{
              ...styles.generationMonitor,
              ...generationMonitorToneStyles[generationMonitor.tone],
            }}
            className="generation-monitor"
            data-testid="generation-monitor"
            data-generation-status={generationMonitor.tone}
            aria-live={generationMonitor.isActive ? "polite" : "off"}
          >
            <span
              style={styles.generationMonitorIcon}
              className={
                generationMonitor.tone === "running"
                  ? "generation-pulse"
                  : undefined
              }
              aria-hidden="true"
            >
              {generationMonitor.tone === "completed"
                ? "✓"
                : generationMonitor.tone === "failed"
                  ? "!"
                  : "●"}
            </span>
            <div style={styles.generationMonitorBody}>
              <div style={styles.generationMonitorHeading}>
                <strong>{generationMonitor.heading}</strong>
                <span data-testid="generation-current-step">
                  現在: {generationMonitor.currentStepLabel}
                </span>
              </div>
              <span style={styles.generationMonitorDescription}>
                {generationMonitor.description}
              </span>
              <div
                style={styles.progressTrack}
                role="progressbar"
                aria-label="動画生成の進捗"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={generationMonitor.percentage}
              >
                <span
                  style={{
                    ...styles.progressFill,
                    width: `${generationMonitor.percentage}%`,
                  }}
                />
              </div>
              <small data-testid="generation-progress-count">
                {generationMonitor.settledStepCount} /{" "}
                {generationMonitor.totalStepCount} 工程 ·{" "}
                {generationMonitor.percentage}%
                {generationMonitor.isActive ? " · 自動更新中" : ""}
              </small>
            </div>
            <button
              style={styles.generationMonitorAction}
              onClick={() => navigateToScreen(generationMonitor.action)}
            >
              {generationMonitor.action === "preview"
                ? "完成動画を見る"
                : "生成状況を見る"}
            </button>
          </aside>
        ) : null}

        {message ? (
          <div
            style={styles.message}
            role="status"
            data-testid="app-message"
            data-job-id={lastCreatedJobId ?? undefined}
          >
            {message}
          </div>
        ) : null}
        {errorMessage ? (
          <div style={styles.errorMessage} role="alert" data-testid="app-error">
            {errorMessage}
            {retryActionRef.current ? (
              <button
                style={styles.inlineButton}
                onClick={() => void runUiAction(retryActionRef.current!)}
              >
                再試行
              </button>
            ) : null}
            <button
              style={styles.inlineButton}
              onClick={() => setErrorMessage("")}
            >
              閉じる
            </button>
          </div>
        ) : null}
        {pendingActions > 0 ? (
          <div style={styles.busyMessage} role="status" aria-live="polite">
            処理中…
          </div>
        ) : null}

        <main style={styles.main} aria-busy={pendingActions > 0}>
          <fieldset
            disabled={pendingActions > 0}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            {activeScreen === "dashboard" ? (
              <div style={styles.screenStack} data-testid="screen-dashboard">
                <section style={styles.welcomePanel} className="welcome-panel">
                  <div style={styles.welcomeCopy}>
                    <span style={styles.eyebrow}>
                      はじめてでも、5つのステップで完成
                    </span>
                    <h2 style={styles.welcomeTitle}>
                      解説したいテーマを、動画にしよう。
                    </h2>
                    <p style={styles.leadText}>
                      難しい設定はあと回しで大丈夫です。まずテーマを入力すると、台本・音声・字幕・映像の下書きを自動で作れます。
                    </p>
                    <div style={styles.actionBar}>
                      <button
                        style={styles.primaryButtonLarge}
                        data-testid="dashboard-create-button"
                        onClick={() => navigateToScreen("wizard")}
                      >
                        ＋ 新しい動画を作る
                      </button>
                      {selectedProject ? (
                        <button
                          style={styles.secondaryButton}
                          onClick={() =>
                            navigateToScreen(recommendedAction.screen)
                          }
                        >
                          {recommendedAction.label}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <ol style={styles.quickSteps} aria-label="動画制作の流れ">
                    {primaryWorkflowNavigation.map((item) => (
                      <li key={item.screen} style={styles.quickStep}>
                        <span style={styles.quickStepNumber}>{item.step}</span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section style={styles.panel}>
                  <div style={styles.sectionHeadingRow}>
                    <div>
                      <span style={styles.eyebrow}>最近の動画</span>
                      <h2 style={styles.panelTitle}>続きから編集する</h2>
                    </div>
                    <button
                      style={styles.quietButton}
                      onClick={() => void runUiAction(refreshDashboard)}
                    >
                      ↻ 最新の状態に更新
                    </button>
                  </div>
                  <div style={styles.metricStrip} aria-label="プロジェクト状況">
                    <span>動画 {dashboardStats.projectCount}本</span>
                    <span>生成中 {dashboardStats.runningJobCount}本</span>
                    {dashboardStats.failedJobCount > 0 ? (
                      <span style={styles.dangerText}>
                        要確認 {dashboardStats.failedJobCount}本
                      </span>
                    ) : (
                      <span>エラーなし</span>
                    )}
                  </div>
                  {projects.length === 0 ? (
                    <div style={styles.emptyState}>
                      <span style={styles.emptyStateIcon} aria-hidden="true">
                        🎬
                      </span>
                      <strong>まだ動画がありません</strong>
                      <span>最初はテーマをひとつ決めるだけで大丈夫です。</span>
                      <button
                        style={styles.primaryButton}
                        onClick={() => navigateToScreen("wizard")}
                      >
                        最初の動画を作る
                      </button>
                    </div>
                  ) : (
                    <div style={styles.projectGrid}>
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          style={styles.projectCard}
                          onClick={() => {
                            void runUiAction(() =>
                              loadProjectDetail(project.id),
                            );
                            setActiveScreen("project");
                          }}
                          aria-label={`${project.theme ?? "テーマ未設定"}を開く`}
                        >
                          <span style={styles.projectCardTop}>
                            <span
                              style={styles.statusPill}
                              data-status={
                                project.latestJob?.status ?? project.status
                              }
                            >
                              {formatStatus(
                                project.latestJob?.status ?? project.status,
                              )}
                            </span>
                            <small>
                              {formatUpdatedAt(project.updatedAt)} 更新
                            </small>
                          </span>
                          <strong style={styles.projectCardTitle}>
                            {project.theme ?? "テーマ未設定"}
                          </strong>
                          <span style={styles.projectCardAction}>
                            編集を続ける →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : null}

            {activeScreen === "wizard" ? (
              <section style={styles.panel} data-testid="screen-wizard">
                <ScreenIntro
                  step="STEP 1"
                  title="どんな動画を作りますか？"
                  description="テーマと作り方を選びます。細かな設定や素材は、あとからいつでも変更できます。"
                />
                <div style={styles.contextNotice} data-testid="wizard-context">
                  <strong>新しい動画として作成します</strong>
                  <span>
                    以前の動画は保存済みです。この画面の内容が混ざることはありません。
                  </span>
                </div>
                <div style={styles.formSection}>
                  <label style={styles.fieldLabel} htmlFor="wizard-theme">
                    <strong>解説したいテーマ</strong>
                    <span>短い言葉でも、具体的な依頼でも構いません。</span>
                  </label>
                  <input
                    id="wizard-theme"
                    data-testid="wizard-theme-input"
                    style={styles.inputLarge}
                    value={wizardTheme}
                    placeholder="例：本能寺の変を5分でわかりやすく解説"
                    onChange={(event) => setWizardTheme(event.target.value)}
                  />
                </div>
                <div style={styles.formSection}>
                  <label style={styles.fieldLabel} htmlFor="wizard-mode">
                    <strong>どこまで自動で作りますか？</strong>
                    <span>迷ったら「全自動」がおすすめです。</span>
                  </label>
                  <select
                    id="wizard-mode"
                    data-testid="wizard-mode-select"
                    style={styles.input}
                    value={wizardMode}
                    onChange={(event) =>
                      setWizardMode(event.target.value as AutomationMode)
                    }
                  >
                    {Object.entries(automationModeLabels).map(
                      ([mode, label]) => (
                        <option key={mode} value={mode}>
                          {label}
                          {mode === "full" ? "（おすすめ）" : ""}
                        </option>
                      ),
                    )}
                  </select>
                  <div style={styles.choiceExplanation}>
                    <strong>{automationModeLabels[wizardMode]}</strong>
                    <span>{automationModeDescriptions[wizardMode]}</span>
                  </div>
                </div>
                {wizardMode === "custom" ? (
                  <details style={styles.advancedDetails} open>
                    <summary>自動化する工程を細かく選ぶ</summary>
                    <p style={styles.helpText}>
                      チェックした工程は今回の生成でスキップします。
                    </p>
                    <div
                      style={styles.checkGrid}
                      data-testid="wizard-custom-steps"
                    >
                      {workflowSteps.map((stepName) => (
                        <label key={stepName} style={styles.checkItem}>
                          <input
                            type="checkbox"
                            checked={customSkipSteps.includes(stepName)}
                            onChange={(event) => {
                              setCustomSkipSteps((current) =>
                                event.target.checked
                                  ? [...new Set([...current, stepName])]
                                  : current.filter((step) => step !== stepName),
                              );
                            }}
                          />
                          <span>{workflowStepLabels[stepName]}</span>
                          <small>省略</small>
                        </label>
                      ))}
                    </div>
                  </details>
                ) : null}
                <details style={styles.advancedDetails}>
                  <summary>以前の設定やテンプレートを使う（任意）</summary>
                  <label style={styles.label}>テンプレート</label>
                  <select
                    style={styles.input}
                    value={wizardTemplateId}
                    onChange={(event) => {
                      const templateId = event.target.value;
                      setWizardTemplateId(templateId);
                      const template = templates.find(
                        (candidate) => candidate.id === templateId,
                      );
                      if (template?.automationProfile) {
                        setWizardMode(template.automationProfile.mode);
                        setCustomSkipSteps(
                          template.automationProfile.skipSteps ?? [],
                        );
                      }
                    }}
                  >
                    <option value="">使わない</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </details>
                <button
                  style={styles.primaryButtonLarge}
                  data-testid="wizard-create-button"
                  onClick={() => void runUiAction(createProject)}
                  disabled={!wizardTheme.trim()}
                >
                  この内容で制作を始める →
                </button>
              </section>
            ) : null}

            {activeScreen === "project" ? (
              <section style={styles.panel} data-testid="screen-project">
                <ScreenIntro
                  step="動画の概要"
                  title={
                    projectDetail?.project.theme ?? "動画を選択してください"
                  }
                  description="現在の状態と、次におすすめの操作をまとめています。細かな再実行やログは下部の詳細から確認できます。"
                />
                {!projectDetail ? (
                  <div style={styles.emptyState}>
                    <strong>編集する動画が選ばれていません</strong>
                    <span>ホームから続きの動画を選んでください。</span>
                    <button
                      style={styles.primaryButton}
                      onClick={() => navigateToScreen("dashboard")}
                    >
                      ホームへ戻る
                    </button>
                  </div>
                ) : null}
                {projectDetail ? (
                  <>
                    <div style={styles.projectOverviewGrid}>
                      <div style={styles.nextActionCard}>
                        <span style={styles.eyebrow}>次におすすめ</span>
                        <strong style={styles.nextActionTitle}>
                          {recommendedAction.label}
                        </strong>
                        <span>{recommendedAction.description}</span>
                        {hasRunningJob ? (
                          <div style={styles.runningIndicator}>
                            <span />{" "}
                            動画を生成しています。画面は自動更新されます。
                          </div>
                        ) : (
                          <button
                            style={styles.primaryButton}
                            onClick={() =>
                              navigateToScreen(recommendedAction.screen)
                            }
                          >
                            {recommendedAction.label} →
                          </button>
                        )}
                      </div>
                      <div style={styles.progressCard}>
                        <span style={styles.eyebrow}>制作状況</span>
                        <strong>
                          {formatStatus(
                            projectDetail.jobs[0]?.status ??
                              projectDetail.project.status,
                          )}
                        </strong>
                        <div
                          style={styles.progressTrack}
                          aria-label="工程の進捗"
                        >
                          <span
                            style={{
                              ...styles.progressFill,
                              width: `${Math.round(((projectDetail.jobs[0]?.steps.filter((step) => ["COMPLETED", "SKIPPED"].includes(step.status)).length ?? 0) / Math.max(1, workflowSteps.length)) * 100)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {projectDetail.jobs[0]?.steps.filter((step) =>
                            ["COMPLETED", "SKIPPED"].includes(step.status),
                          ).length ?? 0}
                          / {workflowSteps.length} 工程
                        </small>
                      </div>
                    </div>
                    <div style={styles.actionBar}>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => navigateToScreen("script")}
                      >
                        台本を編集
                      </button>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => navigateToScreen("timeline")}
                      >
                        タイミングを調整
                      </button>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => navigateToScreen("preview")}
                      >
                        動画を確認
                      </button>
                    </div>
                    <section
                      style={styles.aiUsageCard}
                      data-testid="ai-usage-summary"
                      aria-labelledby="ai-usage-title"
                    >
                      <div style={styles.sectionHeadingRow}>
                        <div>
                          <span style={styles.eyebrow}>この動画の累計</span>
                          <h3 id="ai-usage-title" style={styles.subTitle}>
                            AI使用量と料金目安
                          </h3>
                        </div>
                        {projectDetail.aiUsageSummary.project.requestCount >
                        0 ? (
                          <strong style={styles.aiUsageCost}>
                            {formatEstimatedJpy(
                              projectDetail.aiUsageSummary.project
                                .estimatedCostJpy,
                            )}
                          </strong>
                        ) : null}
                      </div>
                      {projectDetail.aiUsageSummary.project.requestCount ===
                      0 ? (
                        <div style={styles.emptyStateCompact}>
                          APIを使った生成記録はまだありません。手動台本や代替生成は料金に含みません。
                        </div>
                      ) : (
                        <>
                          {projectDetail.aiUsageSummary.latestJob &&
                          projectDetail.aiUsageSummary.latestJob.requestCount >
                            0 ? (
                            <div
                              style={styles.aiUsageLatest}
                              data-testid="ai-usage-latest"
                            >
                              <span>
                                <strong>直近の実行</strong>
                                <small>
                                  API{" "}
                                  {
                                    projectDetail.aiUsageSummary.latestJob
                                      .requestCount
                                  }
                                  回 · 入力{" "}
                                  {formatTokenCount(
                                    projectDetail.aiUsageSummary.latestJob
                                      .inputTokens,
                                  )}{" "}
                                  tokens · 画像{" "}
                                  {
                                    projectDetail.aiUsageSummary.latestJob
                                      .imageCount
                                  }
                                  枚
                                </small>
                              </span>
                              <strong>
                                {formatEstimatedJpy(
                                  projectDetail.aiUsageSummary.latestJob
                                    .estimatedCostJpy,
                                )}
                              </strong>
                            </div>
                          ) : null}
                          <div style={styles.aiUsageMetrics}>
                            <span style={styles.aiUsageMetric}>
                              <small>LLM入力</small>
                              <strong>
                                {formatTokenCount(
                                  projectDetail.aiUsageSummary.project
                                    .inputTokens,
                                )}{" "}
                                tokens
                              </strong>
                            </span>
                            <span style={styles.aiUsageMetric}>
                              <small>LLM出力</small>
                              <strong>
                                {formatTokenCount(
                                  projectDetail.aiUsageSummary.project
                                    .outputTokens,
                                )}{" "}
                                tokens
                              </strong>
                            </span>
                            <span style={styles.aiUsageMetric}>
                              <small>生成画像</small>
                              <strong>
                                {
                                  projectDetail.aiUsageSummary.project
                                    .imageCount
                                }
                                枚
                              </strong>
                            </span>
                            <span style={styles.aiUsageMetric}>
                              <small>概算（USD）</small>
                              <strong>
                                {formatEstimatedUsd(
                                  projectDetail.aiUsageSummary.project
                                    .estimatedCostUsd,
                                )}
                              </strong>
                            </span>
                          </div>
                          <div style={styles.aiModelList}>
                            {projectDetail.aiUsageSummary.project.byModel.map(
                              (usage) => (
                                <div
                                  key={usage.kind + "-" + usage.model}
                                  style={styles.aiModelRow}
                                >
                                  <span>
                                    <strong>{usage.model}</strong>
                                    <small>
                                      {usage.kind === "llm"
                                        ? "LLM · " + usage.requestCount + "回"
                                        : "画像 · " + usage.imageCount + "枚"}
                                    </small>
                                  </span>
                                  <span>
                                    {usage.unpricedRequestCount > 0
                                      ? "単価未登録"
                                      : formatEstimatedUsd(
                                          usage.estimatedCostUsd,
                                        )}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                          <small style={styles.helpText}>
                            各AI提供元の標準公開単価と 1 USD ={" "}
                            {projectDetail.aiUsageSummary.project.usdJpyRate}
                            円での概算です。無料枠・税・契約割引・キャッシュは実請求で変わります。{" "}
                            {(
                              projectDetail.aiUsageSummary.project
                                .pricingSources ?? [
                                projectDetail.aiUsageSummary.project
                                  .pricingSource,
                              ]
                            ).map((source, index) => (
                              <React.Fragment key={source}>
                                {index > 0 ? " / " : ""}
                                <a
                                  style={styles.inlineLink}
                                  href={source}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  単価{index + 1}
                                </a>
                              </React.Fragment>
                            ))}
                          </small>
                        </>
                      )}
                    </section>
                    <details style={styles.advancedDetails}>
                      <summary>再実行・工程・成果物の詳細</summary>
                      <div style={styles.advancedContent}>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => void runUiAction(createRenderJob)}
                        >
                          同じ設定でもう一度生成
                        </button>
                        {projectDetail.jobs.map((job, jobIndex) => (
                          <details
                            key={job.id}
                            style={styles.jobCard}
                            open={jobIndex === 0}
                          >
                            <summary>
                              実行 {projectDetail.jobs.length - jobIndex} ·{" "}
                              {formatStatus(job.status)} ·{" "}
                              {formatUpdatedAt(job.createdAt)}
                            </summary>
                            <div style={styles.stepList}>
                              {job.steps.map((step) => {
                                const stepName =
                                  step.stepName as WorkflowStepName;
                                const label =
                                  workflowStepLabels[stepName] ?? step.stepName;
                                return (
                                  <div
                                    key={`${job.id}-${step.stepName}`}
                                    style={styles.stepRow}
                                  >
                                    <span>
                                      <strong>{label}</strong>
                                      <small>{formatStatus(step.status)}</small>
                                    </span>
                                    <span style={styles.stepActions}>
                                      <button
                                        style={styles.inlineButton}
                                        onClick={() =>
                                          void runUiAction(() =>
                                            createRenderJobFromStep(stepName),
                                          )
                                        }
                                      >
                                        ここからやり直す
                                      </button>
                                      <button
                                        style={styles.inlineButton}
                                        onClick={() =>
                                          void runUiAction(() =>
                                            createRenderJobSkippingStep(
                                              stepName,
                                            ),
                                          )
                                        }
                                      >
                                        今回は省略
                                      </button>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {job.files.length > 0 ? (
                              <details style={styles.nestedDetails}>
                                <summary>
                                  生成ファイル {job.files.length}件
                                </summary>
                                <div style={styles.fileGrid}>
                                  {job.files.map((file) => (
                                    <a
                                      key={file.id}
                                      style={styles.fileLink}
                                      href={buildJobFileUrl(job.id, file.id)}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {file.relativePath.split("/").at(-1)}
                                    </a>
                                  ))}
                                </div>
                              </details>
                            ) : null}
                          </details>
                        ))}
                      </div>
                    </details>
                    <details style={styles.advancedDetails}>
                      <summary>トラブル調査用ログ</summary>
                      <pre style={styles.logBox}>
                        {(projectDetail.logs ?? []).join("\n")}
                      </pre>
                    </details>
                  </>
                ) : null}
              </section>
            ) : null}

            {activeScreen === "script" ? (
              <section style={styles.panel} data-testid="screen-script">
                <ScreenIntro
                  step="STEP 2"
                  title="台本を読みやすく整える"
                  description="自動生成された内容を確認し、話し言葉として自然になるように直します。話者名とセリフは行ごとに編集できます。"
                />
                <label style={styles.fieldLabel}>
                  <strong>動画タイトル</strong>
                  <span>視聴者に内容がひと目で伝わる名前にします。</span>
                </label>
                <input
                  data-testid="script-title-input"
                  style={styles.input}
                  value={scriptDraft.title ?? ""}
                  onChange={(event) =>
                    setScriptDraft({
                      ...scriptDraft,
                      title: event.target.value,
                    })
                  }
                />
                <label style={styles.fieldLabel}>
                  <strong>動画のテーマ</strong>
                  <span>台本を作るときの中心となる話題です。</span>
                </label>
                <input
                  data-testid="script-theme-input"
                  style={styles.input}
                  value={scriptDraft.theme ?? ""}
                  onChange={(event) =>
                    setScriptDraft({
                      ...scriptDraft,
                      theme: event.target.value,
                    })
                  }
                />
                <h3 style={styles.subTitle}>会話の内容</h3>
                {scriptDraft.lines.map((line, index) => (
                  <div key={`line-${index}`} style={styles.dialogueCard}>
                    <span style={styles.dialogueNumber}>{index + 1}</span>
                    <label style={styles.compactField}>
                      <span style={styles.labelInline}>話すキャラクター</span>
                      <select
                        data-testid={`script-line-speaker-${index}`}
                        style={styles.inputSmall}
                        value={line.speaker}
                        onChange={(event) => {
                          const lines = [...scriptDraft.lines];
                          lines[index] = {
                            ...line,
                            speaker: event.target.value,
                          };
                          setScriptDraft({ ...scriptDraft, lines });
                        }}
                      >
                        <option value="reimu">霊夢</option>
                        <option value="marisa">魔理沙</option>
                        {!["reimu", "marisa"].includes(line.speaker) ? (
                          <option value={line.speaker}>{line.speaker}</option>
                        ) : null}
                      </select>
                    </label>
                    <label
                      style={{ ...styles.compactField, flex: "1 1 420px" }}
                    >
                      <span style={styles.labelInline}>セリフ</span>
                      <textarea
                        data-testid={`script-line-text-${index}`}
                        style={{
                          ...styles.input,
                          minHeight: 72,
                          resize: "vertical",
                        }}
                        value={line.text}
                        onChange={(event) => {
                          const lines = [...scriptDraft.lines];
                          lines[index] = { ...line, text: event.target.value };
                          setScriptDraft({ ...scriptDraft, lines });
                        }}
                      />
                    </label>
                  </div>
                ))}
                <button
                  style={styles.secondaryButton}
                  data-testid="script-add-line-button"
                  onClick={() =>
                    setScriptDraft({
                      ...scriptDraft,
                      lines: [
                        ...scriptDraft.lines,
                        { speaker: "reimu", text: "" },
                      ],
                    })
                  }
                >
                  ＋ セリフを追加
                </button>
                <div style={styles.stickyActionBar}>
                  <span>変更内容を保存して、次の素材選びへ進みます。</span>
                  <button
                    style={styles.primaryButton}
                    data-testid="script-save-button"
                    onClick={() => void runUiAction(saveScriptAndContinue)}
                  >
                    保存して素材へ進む →
                  </button>
                </div>
              </section>
            ) : null}

            {activeScreen === "assets" ? (
              <section style={styles.panel} data-testid="screen-assets">
                <ScreenIntro
                  step="STEP 3"
                  title="使いたい画像や音を追加する"
                  description="背景、立ち絵、BGMなどを追加できます。素材がなくても自動生成できるので、この工程はそのまま次へ進んでも大丈夫です。"
                />
                <div style={styles.lineRow}>
                  <select
                    data-testid="asset-type-select"
                    style={styles.inputSmall}
                    value={assetForm.type}
                    onChange={(event) =>
                      setAssetForm({ ...assetForm, type: event.target.value })
                    }
                  >
                    <option value="image">画像</option>
                    <option value="audio">音声</option>
                    <option value="video">動画</option>
                    <option value="subtitle">字幕</option>
                  </select>
                  <select
                    data-testid="asset-usage-select"
                    style={styles.inputSmall}
                    value={assetForm.usage}
                    onChange={(event) =>
                      setAssetForm({ ...assetForm, usage: event.target.value })
                    }
                  >
                    <option value="background">背景</option>
                    <option value="character">立ち絵</option>
                    <option value="bgm">BGM</option>
                    <option value="se">SE</option>
                    <option value="reference">参考素材</option>
                    <option value="other">その他</option>
                  </select>
                  <input
                    data-testid="asset-name-input"
                    style={styles.inputSmall}
                    placeholder="表示名"
                    value={assetForm.name}
                    onChange={(event) =>
                      setAssetForm({ ...assetForm, name: event.target.value })
                    }
                  />
                  <input
                    data-testid="asset-file-input"
                    style={styles.input}
                    type="file"
                    onChange={(event) =>
                      setAssetUploadFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <button
                    style={styles.secondaryButton}
                    data-testid="asset-add-button"
                    onClick={() => void runUiAction(addAsset)}
                  >
                    素材を追加
                  </button>
                </div>
                <details style={styles.advancedDetails}>
                  <summary>
                    すでにプロジェクト内にあるファイルを指定する
                  </summary>
                  <input
                    data-testid="asset-path-input"
                    style={styles.input}
                    placeholder="例：projects/.../input/assets/background.png"
                    value={assetForm.relativePath}
                    onChange={(event) =>
                      setAssetForm({
                        ...assetForm,
                        relativePath: event.target.value,
                      })
                    }
                  />
                </details>
                <div style={styles.list} data-testid="asset-list">
                  {assets.length === 0 ? (
                    <div style={styles.emptyStateCompact}>
                      追加済みの素材はありません。自動生成を使う場合は、このまま次へ進めます。
                    </div>
                  ) : null}
                  {assets.map((asset) => (
                    <div key={asset.id} style={styles.assetRow}>
                      {selectedProjectId && asset.type === "image" ? (
                        <img
                          src={`/api/projects/${selectedProjectId}/assets/${asset.id}/file`}
                          alt={asset.name}
                          style={styles.assetThumb}
                        />
                      ) : null}
                      <strong>{asset.name}</strong>
                      <span>
                        {assetTypeLabels[asset.type] ?? asset.type} /{" "}
                        {assetUsageLabels[asset.usage ?? "other"] ??
                          asset.usage ??
                          "その他"}
                      </span>
                      <small>{asset.relativePath}</small>
                    </div>
                  ))}
                </div>
                <div style={styles.stickyActionBar}>
                  <span>
                    {assets.length > 0
                      ? `${assets.length}件の素材を使用します。`
                      : "素材は自動生成されます。"}
                  </span>
                  <button
                    style={styles.primaryButton}
                    onClick={() => navigateToScreen("timeline")}
                  >
                    編集へ進む →
                  </button>
                </div>
              </section>
            ) : null}

            {activeScreen === "timeline" ? (
              <section style={styles.panel} data-testid="screen-timeline">
                <ScreenIntro
                  step="STEP 4"
                  title="タイミングと見せ方を調整する"
                  description="字幕や音声の位置を見ながら、必要なところだけ調整します。自動生成のままでよければ、保存して確認へ進んでください。"
                />
                {!timelineDraft ? (
                  <div>台本保存後にタイムラインを読み込めます。</div>
                ) : null}
                {timelineDraft ? (
                  <>
                    <div style={styles.actionBar}>
                      <button
                        style={styles.secondaryButton}
                        disabled={timelinePast.length === 0}
                        onClick={undoTimeline}
                      >
                        元に戻す
                      </button>
                      <button
                        style={styles.secondaryButton}
                        disabled={timelineFuture.length === 0}
                        onClick={redoTimeline}
                      >
                        やり直す
                      </button>
                      <span style={styles.stepBadge}>
                        {timelineDirty ? "未保存の変更あり" : "保存済み"}
                      </span>
                    </div>
                    <div style={styles.timelineHeroGrid}>
                      <div
                        style={styles.previewCard}
                        data-testid="timeline-edit-summary"
                      >
                        <div>
                          字幕クリップ:{" "}
                          {
                            summarizeTimelineDraft(timelineDraft)
                              .subtitleClipCount
                          }
                        </div>
                        <div>
                          音声クリップ:{" "}
                          {summarizeTimelineDraft(timelineDraft).audioClipCount}
                        </div>
                        <div>
                          マーカー:{" "}
                          {summarizeTimelineDraft(timelineDraft).markerCount}
                        </div>
                        {timelineViewport ? (
                          <div>
                            表示窓:{" "}
                            {formatTimelineTime(
                              timelineViewport.viewportStartMs,
                            )}{" "}
                            -{" "}
                            {formatTimelineTime(timelineViewport.viewportEndMs)}
                          </div>
                        ) : null}
                      </div>
                      <div style={styles.previewCard}>
                        <div style={styles.lineRow}>
                          <label style={styles.labelInline}>in</label>
                          <input
                            data-testid="timeline-in-input"
                            style={styles.inputSmall}
                            type="number"
                            value={timelineDraft.playbackRange.inMs}
                            onChange={(event) =>
                              mutateTimelineDraft((current) => ({
                                ...current,
                                playbackRange: {
                                  inMs: clampNonNegativeInt(
                                    Number(event.target.value),
                                  ),
                                  outMs: Math.max(
                                    clampNonNegativeInt(
                                      Number(event.target.value),
                                    ),
                                    current.playbackRange.outMs,
                                  ),
                                },
                              }))
                            }
                          />
                          <label style={styles.labelInline}>out</label>
                          <input
                            data-testid="timeline-out-input"
                            style={styles.inputSmall}
                            type="number"
                            value={timelineDraft.playbackRange.outMs}
                            onChange={(event) =>
                              mutateTimelineDraft((current) => ({
                                ...current,
                                playbackRange: {
                                  inMs: current.playbackRange.inMs,
                                  outMs: Math.max(
                                    current.playbackRange.inMs,
                                    clampNonNegativeInt(
                                      Number(event.target.value),
                                    ),
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                        <div style={styles.lineRow}>
                          <label style={styles.labelInline}>playhead</label>
                          <input
                            data-testid="timeline-playhead-input"
                            style={styles.slider}
                            type="range"
                            min={timelineDraft.playbackRange.inMs}
                            max={timelineDraft.playbackRange.outMs}
                            value={
                              timelineViewport?.clampedPlayheadMs ??
                              timelineDraft.playbackRange.inMs
                            }
                            onChange={(event) =>
                              setTimelinePlayheadMs(Number(event.target.value))
                            }
                          />
                          <span>
                            {formatTimelineTime(
                              timelineViewport?.clampedPlayheadMs ?? 0,
                            )}
                          </span>
                        </div>
                        <div style={styles.lineRow}>
                          <label style={styles.labelInline}>zoom</label>
                          <input
                            data-testid="timeline-zoom-input"
                            style={styles.slider}
                            type="range"
                            min={1200}
                            max={Math.max(
                              1200,
                              timelineDraft.playbackRange.outMs -
                                timelineDraft.playbackRange.inMs,
                            )}
                            value={Math.min(
                              timelineZoomWindowMs,
                              Math.max(
                                1200,
                                timelineDraft.playbackRange.outMs -
                                  timelineDraft.playbackRange.inMs,
                              ),
                            )}
                            onChange={(event) =>
                              setTimelineZoomWindowMs(
                                Number(event.target.value),
                              )
                            }
                          />
                          <span>
                            {formatTimelineTime(timelineZoomWindowMs)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.timelineWorkspace}>
                      <div
                        style={styles.timelineVisualPanel}
                        data-testid="timeline-visual-editor"
                      >
                        <div style={styles.timelineRuler}>
                          {timelineTicks.map((tickMs) => (
                            <div
                              key={`tick-${tickMs}`}
                              style={{
                                ...styles.timelineTick,
                                left: `${(
                                  ((tickMs -
                                    (timelineViewport?.viewportStartMs ?? 0)) /
                                    (timelineViewport?.viewportDurationMs ??
                                      1)) *
                                  100
                                ).toFixed(3)}%`,
                              }}
                            >
                              <span style={styles.timelineTickLabel}>
                                {formatTimelineTime(tickMs)}
                              </span>
                            </div>
                          ))}
                          {timelineViewport
                            ? timelineDraft.markers
                                .filter(
                                  (marker) =>
                                    marker.timeMs >=
                                      timelineViewport.viewportStartMs &&
                                    marker.timeMs <=
                                      timelineViewport.viewportEndMs,
                                )
                                .map((marker) => (
                                  <div
                                    key={marker.id}
                                    style={{
                                      ...styles.timelineMarkerLine,
                                      left: `${(
                                        ((marker.timeMs -
                                          timelineViewport.viewportStartMs) /
                                          timelineViewport.viewportDurationMs) *
                                        100
                                      ).toFixed(3)}%`,
                                    }}
                                    title={`${marker.label} ${marker.timeMs}ms`}
                                  />
                                ))
                            : null}
                          {timelineViewport ? (
                            <div
                              style={{
                                ...styles.timelinePlayheadLine,
                                left: `${(
                                  ((timelineViewport.clampedPlayheadMs -
                                    timelineViewport.viewportStartMs) /
                                    timelineViewport.viewportDurationMs) *
                                  100
                                ).toFixed(3)}%`,
                              }}
                            />
                          ) : null}
                        </div>
                        {timelineDraft.tracks.map((track) => {
                          const accent = getTrackAccent(track.type);
                          return (
                            <div
                              key={`visual-${track.id}`}
                              style={styles.timelineLane}
                            >
                              <div style={styles.timelineLaneHeader}>
                                <strong>{track.name}</strong>
                                <small>{track.type}</small>
                              </div>
                              <div
                                style={styles.timelineLaneCanvas}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) =>
                                  handleTimelineDrop(event, track.id)
                                }
                              >
                                {timelineViewport ? (
                                  <div
                                    style={{
                                      ...styles.timelinePlayheadLine,
                                      left: `${(
                                        ((timelineViewport.clampedPlayheadMs -
                                          timelineViewport.viewportStartMs) /
                                          timelineViewport.viewportDurationMs) *
                                        100
                                      ).toFixed(3)}%`,
                                    }}
                                  />
                                ) : null}
                                {track.clips.map((clip) => {
                                  const layout = timelineViewport
                                    ? getVisibleClipLayout(
                                        clip,
                                        timelineViewport,
                                      )
                                    : null;
                                  if (!layout) {
                                    return null;
                                  }
                                  const isSelected =
                                    selectedTimelineClip?.trackId ===
                                      track.id &&
                                    selectedTimelineClip?.clipId === clip.id;
                                  return (
                                    <button
                                      key={clip.id}
                                      type="button"
                                      data-testid={`timeline-clip-block-${track.id}-${clip.id}`}
                                      draggable
                                      onDragStart={(event) =>
                                        handleTimelineClipDragStart(
                                          event,
                                          track.id,
                                          clip.id,
                                          clip.durationMs,
                                        )
                                      }
                                      onClick={() =>
                                        selectTimelineClip(track.id, clip.id)
                                      }
                                      style={{
                                        ...styles.timelineClipBlock,
                                        left: `${layout.leftPercent}%`,
                                        width: `${layout.widthPercent}%`,
                                        background: accent.solid,
                                        boxShadow: isSelected
                                          ? `0 0 0 2px rgba(255,255,255,0.88), 0 14px 26px ${accent.glow}`
                                          : `0 10px 22px ${accent.glow}`,
                                        opacity:
                                          layout.trimmedLeft ||
                                          layout.trimmedRight
                                            ? 0.85
                                            : 1,
                                      }}
                                      title={`${clip.id} ${clip.startMs}ms - ${clip.startMs + clip.durationMs}ms`}
                                    >
                                      <span style={styles.timelineClipTitle}>
                                        {clip.id}
                                      </span>
                                      <span style={styles.timelineClipSubtitle}>
                                        {clip.text ?? clip.assetType}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <aside
                        style={styles.timelineInspector}
                        data-testid="timeline-selected-clip"
                      >
                        <div style={styles.timelineInspectorHeader}>
                          選択中クリップ
                        </div>
                        {selectedClipDetail ? (
                          <>
                            <strong>
                              {selectedClipDetail.track.name} /{" "}
                              {selectedClipDetail.clip.id}
                            </strong>
                            <small>
                              {selectedClipDetail.clip.startMs}ms -{" "}
                              {selectedClipDetail.clip.startMs +
                                selectedClipDetail.clip.durationMs}
                              ms
                            </small>
                            <div style={styles.stepWrap}>
                              <span style={styles.stepBadge}>
                                {selectedClipDetail.track.type}
                              </span>
                              {selectedClipDetail.clip.style ? (
                                <span style={styles.stepBadge}>
                                  {selectedClipDetail.clip.style}
                                </span>
                              ) : null}
                            </div>
                            <div style={styles.lineRow}>
                              <button
                                style={styles.secondaryButton}
                                data-testid="timeline-split-button"
                                onClick={splitSelectedTimelineClip}
                              >
                                プレイヘッドで分割
                              </button>
                              <button
                                style={styles.secondaryButton}
                                onClick={() => nudgeSelectedTimelineClip(-100)}
                              >
                                -100ms
                              </button>
                              <button
                                style={styles.secondaryButton}
                                onClick={() => nudgeSelectedTimelineClip(100)}
                              >
                                +100ms
                              </button>
                            </div>
                            <div style={styles.lineRow}>
                              <button
                                style={styles.secondaryButton}
                                onClick={duplicateSelectedTimelineClip}
                              >
                                複製
                              </button>
                              <button
                                style={styles.secondaryButton}
                                onClick={deleteSelectedTimelineClip}
                              >
                                削除
                              </button>
                            </div>
                            <label style={styles.label}>開始位置</label>
                            <input
                              style={styles.inputSmall}
                              type="number"
                              value={selectedClipDetail.clip.startMs}
                              onChange={(event) =>
                                mutateTimelineDraft((current) =>
                                  updateTimelineClipLocal(
                                    current,
                                    selectedClipDetail.track.id,
                                    selectedClipDetail.clip.id,
                                    {
                                      startMs: Number(event.target.value),
                                    },
                                  ),
                                )
                              }
                            />
                            <label style={styles.label}>長さ</label>
                            <input
                              style={styles.inputSmall}
                              type="number"
                              value={selectedClipDetail.clip.durationMs}
                              onChange={(event) =>
                                mutateTimelineDraft((current) =>
                                  updateTimelineClipLocal(
                                    current,
                                    selectedClipDetail.track.id,
                                    selectedClipDetail.clip.id,
                                    {
                                      durationMs: Number(event.target.value),
                                    },
                                  ),
                                )
                              }
                            />
                            {selectedClipDetail.track.type === "subtitle" ? (
                              <>
                                <label style={styles.label}>字幕本文</label>
                                <input
                                  style={styles.input}
                                  data-testid={`timeline-text-${selectedClipDetail.clip.id}`}
                                  value={selectedClipDetail.clip.text ?? ""}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        selectedClipDetail.track.id,
                                        selectedClipDetail.clip.id,
                                        {
                                          text: event.target.value,
                                        },
                                      ),
                                    )
                                  }
                                />
                                <label style={styles.label}>スタイル</label>
                                <input
                                  style={styles.inputSmall}
                                  value={selectedClipDetail.clip.style ?? ""}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        selectedClipDetail.track.id,
                                        selectedClipDetail.clip.id,
                                        {
                                          style: event.target.value,
                                        },
                                      ),
                                    )
                                  }
                                />
                              </>
                            ) : null}
                            {selectedClipDetail.track.type === "audio" ||
                            selectedClipDetail.track.type === "bgm" ? (
                              <>
                                <label style={styles.label}>音量</label>
                                <input
                                  style={styles.inputSmall}
                                  type="number"
                                  step="0.1"
                                  value={selectedClipDetail.clip.volume ?? 1}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        selectedClipDetail.track.id,
                                        selectedClipDetail.clip.id,
                                        {
                                          volume: Number(event.target.value),
                                        },
                                      ),
                                    )
                                  }
                                />
                                <div style={styles.lineRow}>
                                  <div style={styles.compactField}>
                                    <label style={styles.labelInline}>
                                      fade in
                                    </label>
                                    <input
                                      style={styles.inputSmall}
                                      type="number"
                                      value={
                                        selectedClipDetail.clip.fadeInMs ?? 0
                                      }
                                      onChange={(event) =>
                                        mutateTimelineDraft((current) =>
                                          updateTimelineClipLocal(
                                            current,
                                            selectedClipDetail.track.id,
                                            selectedClipDetail.clip.id,
                                            {
                                              fadeInMs: Number(
                                                event.target.value,
                                              ),
                                            },
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                  <div style={styles.compactField}>
                                    <label style={styles.labelInline}>
                                      fade out
                                    </label>
                                    <input
                                      style={styles.inputSmall}
                                      type="number"
                                      value={
                                        selectedClipDetail.clip.fadeOutMs ?? 0
                                      }
                                      onChange={(event) =>
                                        mutateTimelineDraft((current) =>
                                          updateTimelineClipLocal(
                                            current,
                                            selectedClipDetail.track.id,
                                            selectedClipDetail.clip.id,
                                            {
                                              fadeOutMs: Number(
                                                event.target.value,
                                              ),
                                            },
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <div>
                            レーン上のクリップをクリックすると詳細編集できます。
                          </div>
                        )}
                      </aside>
                    </div>
                    <div style={styles.timelineUtilityGrid}>
                      <div style={styles.timelineUtilityCard}>
                        <div style={styles.lineRow}>
                          <input
                            data-testid="timeline-manual-subtitle-input"
                            style={styles.input}
                            placeholder="手動テロップ本文"
                            value={manualSubtitleText}
                            onChange={(event) =>
                              setManualSubtitleText(event.target.value)
                            }
                          />
                          <button
                            style={styles.secondaryButton}
                            data-testid="timeline-add-subtitle-button"
                            onClick={addManualSubtitle}
                          >
                            手動テロップ追加
                          </button>
                        </div>
                      </div>
                      <div style={styles.timelineUtilityCard}>
                        <div style={styles.lineRow}>
                          <input
                            data-testid="timeline-marker-label-input"
                            style={styles.inputSmall}
                            placeholder="マーカー名"
                            value={manualMarkerLabel}
                            onChange={(event) =>
                              setManualMarkerLabel(event.target.value)
                            }
                          />
                          <input
                            data-testid="timeline-marker-time-input"
                            style={styles.inputSmall}
                            type="number"
                            placeholder="timeMs"
                            value={manualMarkerTimeMs}
                            onChange={(event) =>
                              setManualMarkerTimeMs(event.target.value)
                            }
                          />
                          <button
                            style={styles.secondaryButton}
                            data-testid="timeline-add-marker-button"
                            onClick={addTimelineMarker}
                          >
                            マーカー追加
                          </button>
                        </div>
                        {timelineDraft.markers.length > 0 ? (
                          <div style={styles.stepWrap}>
                            {timelineDraft.markers.map((marker) => (
                              <span key={marker.id} style={styles.stepBadge}>
                                {marker.label}: {marker.timeMs}ms
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {timelineDraft.tracks.map((track) => (
                      <div key={track.id} style={styles.timelineTrack}>
                        <h3 style={styles.subTitle}>{track.name} 詳細一覧</h3>
                        {track.clips.map((clip) => (
                          <div key={clip.id} style={styles.clipEditor}>
                            <div style={styles.lineRow}>
                              <strong>{clip.id}</strong>
                              <button
                                style={styles.secondaryButton}
                                data-testid={`timeline-duplicate-${track.id}-${clip.id}`}
                                onClick={() => {
                                  mutateTimelineDraft((current) =>
                                    duplicateTimelineClipLocal(
                                      current,
                                      track.id,
                                      clip.id,
                                    ),
                                  );
                                  setSelectedTimelineClip({
                                    trackId: track.id,
                                    clipId: predictNextDuplicateClipId(
                                      track.clips,
                                      clip.id,
                                    ),
                                  });
                                }}
                              >
                                複製
                              </button>
                              <button
                                style={styles.secondaryButton}
                                data-testid={`timeline-delete-${track.id}-${clip.id}`}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `クリップ「${clip.id}」を削除しますか？`,
                                    )
                                  )
                                    return;
                                  mutateTimelineDraft((current) =>
                                    deleteTimelineClipLocal(
                                      current,
                                      track.id,
                                      clip.id,
                                    ),
                                  );
                                  if (
                                    selectedTimelineClip?.trackId ===
                                      track.id &&
                                    selectedTimelineClip?.clipId === clip.id
                                  ) {
                                    setSelectedTimelineClip(null);
                                  }
                                }}
                              >
                                削除
                              </button>
                              <button
                                style={styles.secondaryButton}
                                onClick={() =>
                                  selectTimelineClip(track.id, clip.id)
                                }
                              >
                                選択
                              </button>
                            </div>
                            <div style={styles.sliderRow}>
                              <span>開始</span>
                              <input
                                style={styles.slider}
                                type="range"
                                min={0}
                                max={Math.max(
                                  12000,
                                  timelineDraft.playbackRange.outMs + 1000,
                                )}
                                value={clip.startMs}
                                onChange={(event) =>
                                  mutateTimelineDraft((current) =>
                                    updateTimelineClipLocal(
                                      current,
                                      track.id,
                                      clip.id,
                                      {
                                        startMs: Number(event.target.value),
                                      },
                                    ),
                                  )
                                }
                              />
                              <span>{clip.startMs}ms</span>
                            </div>
                            <div style={styles.sliderRow}>
                              <span>長さ</span>
                              <input
                                style={styles.slider}
                                type="range"
                                min={100}
                                max={15000}
                                value={clip.durationMs}
                                onChange={(event) =>
                                  mutateTimelineDraft((current) =>
                                    updateTimelineClipLocal(
                                      current,
                                      track.id,
                                      clip.id,
                                      {
                                        durationMs: Number(event.target.value),
                                      },
                                    ),
                                  )
                                }
                              />
                              <span>{clip.durationMs}ms</span>
                            </div>
                            {track.type === "subtitle" ? (
                              <>
                                <input
                                  style={styles.input}
                                  data-testid={`timeline-text-${clip.id}`}
                                  value={clip.text ?? ""}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        track.id,
                                        clip.id,
                                        {
                                          text: event.target.value,
                                        },
                                      ),
                                    )
                                  }
                                />
                                <input
                                  style={styles.inputSmall}
                                  value={clip.style ?? ""}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        track.id,
                                        clip.id,
                                        {
                                          style: event.target.value,
                                        },
                                      ),
                                    )
                                  }
                                />
                              </>
                            ) : null}
                            {track.type === "audio" || track.type === "bgm" ? (
                              <div style={styles.lineRow}>
                                <input
                                  style={styles.inputSmall}
                                  type="number"
                                  step="0.1"
                                  value={clip.volume ?? 1}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        track.id,
                                        clip.id,
                                        {
                                          volume: Number(event.target.value),
                                        },
                                      ),
                                    )
                                  }
                                />
                                <input
                                  style={styles.inputSmall}
                                  type="number"
                                  value={clip.fadeInMs ?? 0}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        track.id,
                                        clip.id,
                                        {
                                          fadeInMs: Number(event.target.value),
                                        },
                                      ),
                                    )
                                  }
                                />
                                <input
                                  style={styles.inputSmall}
                                  type="number"
                                  value={clip.fadeOutMs ?? 0}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        track.id,
                                        clip.id,
                                        {
                                          fadeOutMs: Number(event.target.value),
                                        },
                                      ),
                                    )
                                  }
                                />
                              </div>
                            ) : null}
                            {clip.text ? <small>{clip.text}</small> : null}
                          </div>
                        ))}
                      </div>
                    ))}
                    <button
                      style={styles.primaryButton}
                      data-testid="timeline-save-button"
                      onClick={() =>
                        void runUiAction(async () => {
                          await saveTimelineAll();
                          setActiveScreen("preview");
                        })
                      }
                    >
                      保存して動画確認へ →
                    </button>
                    <button
                      style={styles.secondaryButton}
                      onClick={() =>
                        void runUiAction(createTemplateFromCurrent)
                      }
                    >
                      テンプレート化
                    </button>
                  </>
                ) : null}
              </section>
            ) : null}

            {activeScreen === "preview" ? (
              <section style={styles.panel} data-testid="screen-preview">
                <ScreenIntro
                  step="STEP 5"
                  title="動画を確認して完成版を書き出す"
                  description="プレビューで内容を確認し、問題がなければ完成動画を生成します。生成には数分かかることがあります。"
                />
                <div style={styles.actionBar}>
                  <button
                    style={styles.secondaryButton}
                    data-testid="preview-load-button"
                    onClick={() => void runUiAction(loadPreview)}
                  >
                    内容を更新
                  </button>
                  <button
                    style={styles.primaryButton}
                    data-testid="preview-render-button"
                    onClick={() => void runUiAction(createRenderJob)}
                  >
                    完成動画を生成
                  </button>
                  {finalVideoUrl ? (
                    <a
                      style={styles.downloadButton}
                      href={finalVideoUrl}
                      download
                    >
                      完成動画をダウンロード
                    </a>
                  ) : null}
                </div>
                {previewVideoUrl ? (
                  <video
                    data-testid="preview-video"
                    ref={previewVideoRef}
                    style={styles.videoPlayer}
                    src={previewVideoUrl}
                    controls
                    onLoadedMetadata={(event) => {
                      event.currentTarget.currentTime =
                        timelinePlayheadMs / 1000;
                    }}
                    onTimeUpdate={(event) => {
                      setTimelinePlayheadMs(
                        Math.round(event.currentTarget.currentTime * 1000),
                      );
                    }}
                  />
                ) : null}
                {preview ? (
                  <div style={styles.previewCard} data-testid="preview-summary">
                    <strong>今回の動画</strong>
                    <div>
                      長さ:{" "}
                      {formatTimelineTime(preview.remotionProps.durationMs)}
                    </div>
                    {preview.outputPreset ? (
                      <div>
                        出力: {preview.outputPreset.width}x
                        {preview.outputPreset.height} /{" "}
                        {preview.outputPreset.fps}
                        fps
                      </div>
                    ) : null}
                    <div>
                      字幕 {preview.remotionProps.subtitleTracks.length}件 /
                      音声 {preview.remotionProps.audioTracks.length}件
                    </div>
                    <div data-testid="preview-manual-summary">
                      手動編集: 字幕{" "}
                      {
                        preview.remotionProps.manualEditSummary
                          .subtitleClipCount
                      }{" "}
                      / 音声{" "}
                      {preview.remotionProps.manualEditSummary.audioClipCount} /
                      マーカー{" "}
                      {preview.remotionProps.manualEditSummary.markerCount} /
                      トリム{" "}
                      {preview.remotionProps.manualEditSummary
                        .playbackRangeApplied
                        ? "あり"
                        : "なし"}
                    </div>
                    <details style={styles.nestedDetails}>
                      <summary>技術情報</summary>
                      <div>
                        durationInFrames:{" "}
                        {preview.remotionProps.durationInFrames}
                      </div>
                      <div>durationMs: {preview.remotionProps.durationMs}</div>
                    </details>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeScreen === "settings" ? (
              <section style={styles.panel} data-testid="screen-settings">
                <ScreenIntro
                  step="アプリ設定"
                  title="生成と出力の設定"
                  description="Gemini・OpenAI・Claudeから台本モデルを選び、Gemini・OpenAIから画像モデルを選べます。モデル設定は次に開始する生成から反映されます。"
                />
                <div style={styles.settingsGrid}>
                  <section style={styles.settingsCard}>
                    <div>
                      <span style={styles.eyebrow}>AIモデル</span>
                      <h3 style={styles.subTitle}>品質と料金を選ぶ</h3>
                    </div>
                    <label style={styles.fieldLabel}>
                      <strong>台本生成モデル</strong>
                      <span>テーマから会話形式の台本を作るモデルです。</span>
                      <select
                        style={styles.input}
                        data-testid="settings-script-model-select"
                        value={settings.models.script}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            models: {
                              ...settings.models,
                              script: event.target
                                .value as AppSettings["models"]["script"],
                            },
                          })
                        }
                      >
                        {SCRIPT_MODEL_OPTIONS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                      <small style={styles.helpText}>
                        {
                          SCRIPT_MODEL_OPTIONS.find(
                            (model) => model.id === settings.models.script,
                          )?.description
                        }
                      </small>
                    </label>
                    <label style={styles.fieldLabel}>
                      <strong>画像生成モデル</strong>
                      <span>背景と挿絵を16:9の1K画像として作ります。</span>
                      <select
                        style={styles.input}
                        data-testid="settings-image-model-select"
                        value={settings.models.image}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            models: {
                              ...settings.models,
                              image: event.target
                                .value as AppSettings["models"]["image"],
                            },
                          })
                        }
                      >
                        {IMAGE_MODEL_OPTIONS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                      <small style={styles.helpText}>
                        {
                          IMAGE_MODEL_OPTIONS.find(
                            (model) => model.id === settings.models.image,
                          )?.description
                        }
                      </small>
                    </label>
                  </section>

                  {apiProviderSettings.map((provider) => (
                    <section key={provider.id} style={styles.settingsCard}>
                      <div style={styles.sectionHeadingRow}>
                        <div>
                          <span style={styles.eyebrow}>API接続</span>
                          <h3 style={styles.subTitle}>{provider.title}</h3>
                        </div>
                        <span
                          style={styles.stepBadge}
                          data-testid={`settings-${provider.id}-status`}
                        >
                          {getApiStatusLabel(provider.statusField)}
                        </span>
                      </div>
                      <p style={styles.helpText}>{provider.description}</p>
                      <p style={styles.helpText}>
                        キーは秘密情報ファイルへ分離して保存し、保存後は画面やAPIで再表示しません。
                      </p>
                      <label style={styles.fieldLabel}>
                        <strong>新しいAPIキー</strong>
                        <input
                          type="password"
                          autoComplete="new-password"
                          spellCheck={false}
                          style={styles.input}
                          data-testid={`settings-${provider.id}-key-input`}
                          value={apiKeyDrafts[provider.id]}
                          placeholder={provider.placeholder}
                          onChange={(event) =>
                            setApiKeyDrafts((current) => ({
                              ...current,
                              [provider.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div style={styles.lineRow}>
                        <button
                          style={styles.primaryButton}
                          data-testid={`settings-${provider.id}-key-save`}
                          disabled={
                            apiKeyDrafts[provider.id].trim().length < 10
                          }
                          onClick={() =>
                            void runUiAction(() =>
                              saveProviderApiKey(provider.id),
                            )
                          }
                        >
                          APIキーを登録
                        </button>
                        {secretSettingsStatus?.[provider.statusField].source ===
                        "stored" ? (
                          <button
                            style={styles.quietDangerButton}
                            onClick={() =>
                              void runUiAction(() =>
                                clearProviderApiKey(provider.id),
                              )
                            }
                          >
                            保存キーを削除
                          </button>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>
                <section style={styles.settingsCard}>
                  <div style={styles.sectionHeadingRow}>
                    <div>
                      <span style={styles.eyebrow}>接続確認</span>
                      <h3 style={styles.subTitle}>登録済みサービスを診断</h3>
                    </div>
                    <button
                      style={styles.secondaryButton}
                      data-testid="settings-diagnostics-button"
                      onClick={() => void runUiAction(loadSettingsDiagnostics)}
                    >
                      実際に接続診断
                    </button>
                  </div>
                  <div style={styles.connectionStatusRow}>
                    <span
                      style={styles.stepBadge}
                      data-testid="settings-aivis-status"
                    >
                      Aivis:{" "}
                      {settingsDiagnostics?.aivisSpeech.reachable
                        ? "接続OK"
                        : settingsDiagnostics?.aivisSpeech.configured
                          ? "未接続"
                          : "未設定"}
                    </span>
                  </div>
                </section>
                <section style={styles.settingsCard}>
                  <div>
                    <span style={styles.eyebrow}>動画出力</span>
                    <h3 style={styles.subTitle}>完成動画のサイズ</h3>
                  </div>
                  <div style={styles.lineRow}>
                    <label style={styles.compactField}>
                      <span style={styles.labelInline}>横幅</span>
                      <input
                        data-testid="settings-width-input"
                        style={styles.inputSmall}
                        type="number"
                        value={settings.outputPreset.width}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            outputPreset: {
                              ...settings.outputPreset,
                              width: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label style={styles.compactField}>
                      <span style={styles.labelInline}>高さ</span>
                      <input
                        data-testid="settings-height-input"
                        style={styles.inputSmall}
                        type="number"
                        value={settings.outputPreset.height}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            outputPreset: {
                              ...settings.outputPreset,
                              height: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label style={styles.compactField}>
                      <span style={styles.labelInline}>FPS</span>
                      <input
                        data-testid="settings-fps-input"
                        style={styles.inputSmall}
                        type="number"
                        value={settings.outputPreset.fps}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            outputPreset: {
                              ...settings.outputPreset,
                              fps: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  <button
                    style={styles.primaryButton}
                    data-testid="settings-save-button"
                    onClick={() => void runUiAction(saveSettings)}
                  >
                    モデルと動画設定を保存
                  </button>
                </section>
              </section>
            ) : null}
          </fieldset>
        </main>
      </div>
    </div>
  );
}

const generationMonitorToneStyles: Record<
  ReturnType<typeof getGenerationProgress>["tone"],
  React.CSSProperties
> = {
  pending: {
    borderColor: "rgba(250, 204, 21, .55)",
    background:
      "linear-gradient(120deg, rgba(66, 48, 8, .94), rgba(22, 32, 58, .96))",
  },
  running: {
    borderColor: "rgba(34, 211, 238, .72)",
    background:
      "linear-gradient(120deg, rgba(8, 47, 73, .96), rgba(16, 35, 67, .96))",
  },
  completed: {
    borderColor: "rgba(74, 222, 128, .62)",
    background:
      "linear-gradient(120deg, rgba(7, 65, 45, .9), rgba(15, 38, 59, .96))",
  },
  failed: {
    borderColor: "rgba(248, 113, 113, .72)",
    background:
      "linear-gradient(120deg, rgba(69, 20, 30, .94), rgba(31, 30, 55, .96))",
  },
  cancelled: {
    borderColor: "rgba(148, 163, 184, .45)",
    background: "rgba(30, 41, 59, .94)",
  },
};

const ScreenIntro: React.FC<{
  step: string;
  title: string;
  description: string;
}> = ({ step, title, description }) => (
  <div style={styles.screenIntro}>
    <span style={styles.eyebrow}>{step}</span>
    <h2 style={styles.panelTitle}>{title}</h2>
    <p style={styles.leadText}>{description}</p>
  </div>
);
