import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "./apiClient";
import type {
  AppSettings,
  DashboardStats,
  PreviewResponse,
  ProjectAsset,
  ProjectDetail,
  ProjectSummary,
  ScriptData,
  SettingsDiagnostics,
  Template,
} from "./apiTypes";
import {
  automationModeLabels,
  buildJobRequest,
  workflowStepLabels,
  workflowSteps,
  type AutomationMode,
  type WorkflowStepName,
} from "./automationProfiles";
import { screens, type ScreenId } from "./screenConfig";
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

const buildJobFileUrl = (jobId: string, fileId: string) =>
  `/api/jobs/${jobId}/files/${fileId}`;

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
    apiKeys: {},
    outputPreset: { width: 1920, height: 1080, fps: 30 },
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
      await Promise.all([refreshDashboard(), loadSettings(), loadTemplates()]);
    });
  }, []);

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
    setMessage(`プロジェクトを作成しました: ${created.projectId}`);
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
    setMessage(`レンダリングジョブを作成しました: ${created.jobId}`);
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
    setMessage(
      `${workflowStepLabels[stepName]} から再実行しました: ${created.jobId}`,
    );
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
    setMessage(
      `${workflowStepLabels[stepName]} をスキップして実行しました: ${created.jobId}`,
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

  const saveSettings = async () => {
    await fetchJson(
      selectedProjectId
        ? `/api/projects/${selectedProjectId}/settings`
        : "/api/settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKeys: {},
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
    setMessage(`テンプレートを作成しました: ${templateId}`);
  };

  return (
    <div style={styles.page}>
      <style>{styleText}</style>
      <div style={styles.backgroundShapeOne} />
      <div style={styles.backgroundShapeTwo} />
      <header style={styles.header}>
        <div>
          <div style={styles.kicker}>Yukkuri Movie Maker</div>
          <h1 style={styles.title}>制作コントロールパネル</h1>
        </div>
        <div style={styles.statusCard}>
          <div>選択中プロジェクト</div>
          <strong data-testid="selected-project-id">
            {selectedProject?.id ?? "未選択"}
          </strong>
          <small>{selectedProject?.theme ?? "テーマ未設定"}</small>
        </div>
      </header>

      <nav style={styles.navBar}>
        {screens.map((screen) => (
          <button
            key={screen.id}
            data-testid={`nav-${screen.id}`}
            onClick={() => setActiveScreen(screen.id)}
            className={screen.id === activeScreen ? "tab-active" : "tab"}
          >
            {screen.label}
          </button>
        ))}
      </nav>

      {message ? (
        <div style={styles.message} role="status" data-testid="app-message">
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
            <section style={styles.panel} data-testid="screen-dashboard">
              <h2 style={styles.panelTitle}>プロジェクト一覧</h2>
              <div style={styles.metricRow}>
                <Metric
                  label="プロジェクト数"
                  value={dashboardStats.projectCount}
                />
                <Metric
                  label="実行中ジョブ"
                  value={dashboardStats.runningJobCount}
                />
                <Metric
                  label="失敗ジョブ"
                  value={dashboardStats.failedJobCount}
                />
              </div>
              <button
                style={styles.secondaryButton}
                onClick={() => void runUiAction(refreshDashboard)}
              >
                最新化
              </button>
              {projects.length === 0 ? (
                <div style={styles.infoCard}>
                  プロジェクトがありません。「作成ウィザード」から最初の動画テーマを登録してください。
                  <button
                    style={styles.inlineButton}
                    onClick={() => setActiveScreen("wizard")}
                  >
                    作成へ進む
                  </button>
                </div>
              ) : null}
              <div style={styles.list}>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    style={styles.listItem}
                    onClick={() => {
                      void runUiAction(() => loadProjectDetail(project.id));
                      setActiveScreen("project");
                    }}
                  >
                    <div>{project.theme ?? "(テーマ未設定)"}</div>
                    <small>{project.id}</small>
                    <small>
                      最新ジョブ:{" "}
                      {project.latestJob
                        ? formatStatus(project.latestJob.status)
                        : "なし"}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {activeScreen === "wizard" ? (
            <section style={styles.panel} data-testid="screen-wizard">
              <h2 style={styles.panelTitle}>プロジェクト作成ウィザード</h2>
              <label style={styles.label}>テーマ</label>
              <input
                data-testid="wizard-theme-input"
                style={styles.input}
                value={wizardTheme}
                onChange={(event) => setWizardTheme(event.target.value)}
              />
              <label style={styles.label}>モード</label>
              <select
                data-testid="wizard-mode-select"
                style={styles.input}
                value={wizardMode}
                onChange={(event) =>
                  setWizardMode(event.target.value as AutomationMode)
                }
              >
                {Object.entries(automationModeLabels).map(([mode, label]) => (
                  <option key={mode} value={mode}>
                    {label}
                  </option>
                ))}
              </select>
              {wizardMode === "custom" ? (
                <div style={styles.checkGrid} data-testid="wizard-custom-steps">
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
                      <small>skip</small>
                    </label>
                  ))}
                </div>
              ) : null}
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
                <option value="">なし</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                style={styles.primaryButton}
                data-testid="wizard-create-button"
                onClick={() => void runUiAction(createProject)}
              >
                作成
              </button>
            </section>
          ) : null}

          {activeScreen === "project" ? (
            <section style={styles.panel} data-testid="screen-project">
              <h2 style={styles.panelTitle}>プロジェクト詳細</h2>
              {!projectDetail ? (
                <div>プロジェクトを選択してください</div>
              ) : null}
              {projectDetail ? (
                <>
                  <div style={styles.cardGrid}>
                    <InfoCard
                      label="テーマ"
                      value={projectDetail.project.theme ?? "未設定"}
                    />
                    <InfoCard
                      label="ステータス"
                      value={formatStatus(projectDetail.project.status)}
                    />
                    <InfoCard
                      label="ジョブ数"
                      value={String(projectDetail.jobs.length)}
                    />
                  </div>
                  <button
                    style={styles.primaryButton}
                    onClick={() => void runUiAction(createRenderJob)}
                  >
                    {projectDetail.jobs.length === 0
                      ? "この設定で生成"
                      : "同じ設定で再実行"}
                  </button>
                  <h3 style={styles.subTitle}>ジョブ履歴</h3>
                  {projectDetail.jobs.map((job) => (
                    <div key={job.id} style={styles.jobCard}>
                      <strong>{job.id}</strong>
                      <div>{formatStatus(job.status)}</div>
                      <div style={styles.stepWrap}>
                        {job.steps.map((step) => {
                          const stepName = step.stepName as WorkflowStepName;
                          const label =
                            workflowStepLabels[stepName] ?? step.stepName;
                          return (
                            <span
                              key={`${job.id}-${step.stepName}`}
                              style={styles.stepBadge}
                            >
                              {label}: {formatStatus(step.status)}
                              <button
                                style={styles.inlineButton}
                                onClick={() =>
                                  void runUiAction(() =>
                                    createRenderJobFromStep(stepName),
                                  )
                                }
                              >
                                ここから
                              </button>
                              <button
                                style={styles.inlineButton}
                                onClick={() =>
                                  void runUiAction(() =>
                                    createRenderJobSkippingStep(stepName),
                                  )
                                }
                              >
                                skip
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      {job.files.length > 0 ? (
                        <div style={styles.fileGrid}>
                          {job.files.map((file) => (
                            <a
                              key={file.id}
                              style={styles.fileLink}
                              href={buildJobFileUrl(job.id, file.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {file.fileCategory}/{file.fileType}:{" "}
                              {file.relativePath.split("/").at(-1)}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <h3 style={styles.subTitle}>ログ</h3>
                  <pre style={styles.logBox}>
                    {(projectDetail.logs ?? []).join("\n")}
                  </pre>
                </>
              ) : null}
            </section>
          ) : null}

          {activeScreen === "script" ? (
            <section style={styles.panel} data-testid="screen-script">
              <h2 style={styles.panelTitle}>台本編集</h2>
              <label style={styles.label}>タイトル</label>
              <input
                data-testid="script-title-input"
                style={styles.input}
                value={scriptDraft.title ?? ""}
                onChange={(event) =>
                  setScriptDraft({ ...scriptDraft, title: event.target.value })
                }
              />
              <label style={styles.label}>テーマ</label>
              <input
                data-testid="script-theme-input"
                style={styles.input}
                value={scriptDraft.theme ?? ""}
                onChange={(event) =>
                  setScriptDraft({ ...scriptDraft, theme: event.target.value })
                }
              />
              <h3 style={styles.subTitle}>セリフ</h3>
              {scriptDraft.lines.map((line, index) => (
                <div key={`line-${index}`} style={styles.lineRow}>
                  <input
                    data-testid={`script-line-speaker-${index}`}
                    style={styles.inputSmall}
                    value={line.speaker}
                    onChange={(event) => {
                      const lines = [...scriptDraft.lines];
                      lines[index] = { ...line, speaker: event.target.value };
                      setScriptDraft({ ...scriptDraft, lines });
                    }}
                  />
                  <input
                    data-testid={`script-line-text-${index}`}
                    style={styles.input}
                    value={line.text}
                    onChange={(event) => {
                      const lines = [...scriptDraft.lines];
                      lines[index] = { ...line, text: event.target.value };
                      setScriptDraft({ ...scriptDraft, lines });
                    }}
                  />
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
                行を追加
              </button>
              <button
                style={styles.primaryButton}
                data-testid="script-save-button"
                onClick={() => void runUiAction(saveScript)}
              >
                保存
              </button>
            </section>
          ) : null}

          {activeScreen === "assets" ? (
            <section style={styles.panel} data-testid="screen-assets">
              <h2 style={styles.panelTitle}>素材管理</h2>
              <div style={styles.lineRow}>
                <select
                  data-testid="asset-type-select"
                  style={styles.inputSmall}
                  value={assetForm.type}
                  onChange={(event) =>
                    setAssetForm({ ...assetForm, type: event.target.value })
                  }
                >
                  <option value="image">image</option>
                  <option value="audio">audio</option>
                  <option value="video">video</option>
                  <option value="subtitle">subtitle</option>
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
                <input
                  data-testid="asset-path-input"
                  style={styles.input}
                  placeholder="既存relativePath"
                  value={assetForm.relativePath}
                  onChange={(event) =>
                    setAssetForm({
                      ...assetForm,
                      relativePath: event.target.value,
                    })
                  }
                />
                <button
                  style={styles.secondaryButton}
                  data-testid="asset-add-button"
                  onClick={() => void runUiAction(addAsset)}
                >
                  登録
                </button>
              </div>
              <div style={styles.list} data-testid="asset-list">
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
                      {asset.type} / {asset.usage ?? "other"}
                    </span>
                    <small>{asset.relativePath}</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeScreen === "timeline" ? (
            <section style={styles.panel} data-testid="screen-timeline">
              <h2 style={styles.panelTitle}>タイムライン編集</h2>
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
                          {formatTimelineTime(timelineViewport.viewportStartMs)}{" "}
                          - {formatTimelineTime(timelineViewport.viewportEndMs)}
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
                            setTimelineZoomWindowMs(Number(event.target.value))
                          }
                        />
                        <span>{formatTimelineTime(timelineZoomWindowMs)}</span>
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
                                  (timelineViewport?.viewportDurationMs ?? 1)) *
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
                                  ? getVisibleClipLayout(clip, timelineViewport)
                                  : null;
                                if (!layout) {
                                  return null;
                                }
                                const isSelected =
                                  selectedTimelineClip?.trackId === track.id &&
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
                                  selectedTimelineClip?.trackId === track.id &&
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
                    onClick={() => void runUiAction(saveTimelineAll)}
                  >
                    タイムライン保存
                  </button>
                  <button
                    style={styles.secondaryButton}
                    onClick={() => void runUiAction(createTemplateFromCurrent)}
                  >
                    テンプレート化
                  </button>
                </>
              ) : null}
            </section>
          ) : null}

          {activeScreen === "preview" ? (
            <section style={styles.panel} data-testid="screen-preview">
              <h2 style={styles.panelTitle}>プレビュー & レンダリング</h2>
              <div style={styles.actionBar}>
                <button
                  style={styles.secondaryButton}
                  data-testid="preview-load-button"
                  onClick={() => void runUiAction(loadPreview)}
                >
                  プレビュー情報を取得
                </button>
                <button
                  style={styles.primaryButton}
                  data-testid="preview-render-button"
                  onClick={() => void runUiAction(createRenderJob)}
                >
                  レンダリング実行
                </button>
                {finalVideoUrl ? (
                  <a
                    style={styles.downloadButton}
                    href={finalVideoUrl}
                    download
                  >
                    final.mp4
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
                    event.currentTarget.currentTime = timelinePlayheadMs / 1000;
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
                  <div>
                    durationInFrames: {preview.remotionProps.durationInFrames}
                  </div>
                  <div>durationMs: {preview.remotionProps.durationMs}</div>
                  {preview.outputPreset ? (
                    <div>
                      出力: {preview.outputPreset.width}x
                      {preview.outputPreset.height} / {preview.outputPreset.fps}
                      fps
                    </div>
                  ) : null}
                  <div>
                    字幕クリップ数:{" "}
                    {preview.remotionProps.subtitleTracks.length}
                  </div>
                  <div>
                    音声クリップ数: {preview.remotionProps.audioTracks.length}
                  </div>
                  <div data-testid="preview-manual-summary">
                    手動編集: 字幕{" "}
                    {preview.remotionProps.manualEditSummary.subtitleClipCount}{" "}
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
                </div>
              ) : null}
            </section>
          ) : null}

          {activeScreen === "settings" ? (
            <section style={styles.panel} data-testid="screen-settings">
              <h2 style={styles.panelTitle}>設定</h2>
              <div style={styles.actionBar}>
                <button
                  style={styles.secondaryButton}
                  data-testid="settings-diagnostics-button"
                  onClick={() => void runUiAction(loadSettingsDiagnostics)}
                >
                  接続診断
                </button>
                {settingsDiagnostics ? (
                  <>
                    <span
                      style={styles.stepBadge}
                      data-testid="settings-google-status"
                    >
                      Gemini:{" "}
                      {settingsDiagnostics.googleApiKey.configured
                        ? "設定済み"
                        : "未設定"}
                    </span>
                    <span
                      style={styles.stepBadge}
                      data-testid="settings-aivis-status"
                    >
                      Aivis:{" "}
                      {settingsDiagnostics.aivisSpeech.reachable
                        ? "接続OK"
                        : settingsDiagnostics.aivisSpeech.configured
                          ? "未接続"
                          : "未設定"}
                    </span>
                  </>
                ) : null}
              </div>
              <div style={styles.lineRow}>
                <label style={styles.labelInline}>Width</label>
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
                <label style={styles.labelInline}>Height</label>
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
                <label style={styles.labelInline}>FPS</label>
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
              </div>
              <button
                style={styles.primaryButton}
                data-testid="settings-save-button"
                onClick={() => void runUiAction(saveSettings)}
              >
                保存
              </button>
            </section>
          ) : null}
        </fieldset>
      </main>
    </div>
  );
}

const Metric: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div style={styles.metricCard}>
    <div>{label}</div>
    <strong style={styles.metricValue}>{value}</strong>
  </div>
);

const InfoCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div style={styles.infoCard}>
    <small>{label}</small>
    <strong>{value}</strong>
  </div>
);
