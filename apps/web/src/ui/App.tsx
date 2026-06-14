import React, { useEffect, useMemo, useState } from "react";

type DashboardStats = {
  projectCount: number;
  runningJobCount: number;
  failedJobCount: number;
};

type ProjectSummary = {
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

type ScriptLine = {
  speaker: string;
  text: string;
  emotion?: string;
};

type ScriptData = {
  title?: string;
  theme?: string;
  lines: ScriptLine[];
};

type TimelineClip = {
  id: string;
  assetType: string;
  assetPath: string;
  startMs: number;
  durationMs: number;
  inMs?: number;
  outMs?: number;
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  text?: string;
  style?: string;
};

type TimelineMarker = {
  id: string;
  timeMs: number;
  label: string;
};

type TimelineTrack = {
  id: string;
  name: string;
  type: string;
  clips: TimelineClip[];
};

type TimelineData = {
  playbackRange: { inMs: number; outMs: number };
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
};

type SelectedTimelineClip = {
  trackId: string;
  clipId: string;
};

type ProjectAsset = {
  id: string;
  type: string;
  name: string;
  relativePath: string;
  createdAt: string;
};

type ProjectDetail = {
  project: {
    id: string;
    theme: string | null;
    status: string;
  };
  jobs: Array<{
    id: string;
    status: string;
    mode: string;
    createdAt: string;
    steps: Array<{ stepName: string; status: string; completedAt?: string }>;
    files: Array<{ relativePath: string; fileType: string; fileCategory: string }>;
  }>;
  script: ScriptData | null;
  timeline: TimelineData | null;
  assets: ProjectAsset[];
  logs: string[];
};

type AppSettings = {
  apiKeys: {
    google?: string;
    openai?: string;
    stability?: string;
  };
  outputPreset: {
    width: number;
    height: number;
    fps: number;
  };
};

type Template = {
  id: string;
  name: string;
  description?: string;
};

type PreviewResponse = {
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

type ScreenId =
  | "dashboard"
  | "wizard"
  | "project"
  | "script"
  | "assets"
  | "timeline"
  | "preview"
  | "settings";

const screens: Array<{ id: ScreenId; label: string }> = [
  { id: "dashboard", label: "ダッシュボード" },
  { id: "wizard", label: "作成ウィザード" },
  { id: "project", label: "プロジェクト詳細" },
  { id: "script", label: "台本編集" },
  { id: "assets", label: "素材管理" },
  { id: "timeline", label: "タイムライン" },
  { id: "preview", label: "プレビュー" },
  { id: "settings", label: "設定" },
];

const fetchJson = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? "request_failed");
  }
  return body as T;
};

const initialScript: ScriptData = {
  title: "",
  theme: "",
  lines: [
    { speaker: "reimu", text: "" },
    { speaker: "marisa", text: "" },
  ],
};

const clampNonNegativeInt = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const clampPositiveInt = (value: number, minimum = 100) =>
  Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : minimum;

const sortTimelineClips = (clips: TimelineClip[]) =>
  [...clips].sort((left, right) => left.startMs - right.startMs);

const sortTimelineMarkers = (markers: TimelineMarker[]) =>
  [...markers].sort((left, right) => left.timeMs - right.timeMs);

const updateTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string,
  patch: Partial<TimelineClip>
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === trackId
      ? {
          ...track,
          clips: sortTimelineClips(
            track.clips.map((clip) =>
              clip.id === clipId
                ? {
                    ...clip,
                    ...patch,
                    startMs:
                      patch.startMs === undefined
                        ? clip.startMs
                        : clampNonNegativeInt(patch.startMs),
                    durationMs:
                      patch.durationMs === undefined
                        ? clip.durationMs
                        : clampPositiveInt(patch.durationMs),
                    inMs:
                      patch.inMs === undefined
                        ? clip.inMs
                        : clampNonNegativeInt(patch.inMs),
                    outMs:
                      patch.outMs === undefined
                        ? clip.outMs
                        : clampNonNegativeInt(patch.outMs),
                    volume:
                      patch.volume === undefined
                        ? clip.volume
                        : Math.min(2, Math.max(0, patch.volume)),
                    fadeInMs:
                      patch.fadeInMs === undefined
                        ? clip.fadeInMs
                        : clampNonNegativeInt(patch.fadeInMs),
                    fadeOutMs:
                      patch.fadeOutMs === undefined
                        ? clip.fadeOutMs
                        : clampNonNegativeInt(patch.fadeOutMs),
                  }
                : clip
            )
          ),
        }
      : track
  ),
});

const duplicateTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }
    const source = track.clips.find((clip) => clip.id === clipId);
    if (!source) {
      return track;
    }
    const duplicateIdBase = `${clipId}-copy`;
    let duplicateId = duplicateIdBase;
    let suffix = 2;
    while (track.clips.some((clip) => clip.id === duplicateId)) {
      duplicateId = `${duplicateIdBase}-${suffix}`;
      suffix += 1;
    }
    return {
      ...track,
      clips: sortTimelineClips([
        ...track.clips,
        {
          ...source,
          id: duplicateId,
          startMs: source.startMs + source.durationMs,
        },
      ]),
    };
  }),
});

const deleteTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) =>
    track.id === trackId
      ? {
          ...track,
          clips: track.clips.filter((clip) => clip.id !== clipId),
        }
      : track
  ),
});

const addManualSubtitleClipLocal = (
  timeline: TimelineData,
  text: string,
  clipId?: string
): TimelineData => {
  const subtitleTrack =
    timeline.tracks.find((track) => track.type === "subtitle") ??
    ({
      id: "track-subtitle",
      name: "字幕",
      type: "subtitle",
      clips: [],
    } satisfies TimelineTrack);
  const lastClip = subtitleTrack.clips[subtitleTrack.clips.length - 1] ?? null;
  const nextStartMs =
    lastClip?.startMs !== undefined
      ? lastClip.startMs + lastClip.durationMs
      : timeline.playbackRange.inMs;
  const nextClip: TimelineClip = {
    id: clipId ?? `manual-sub-${Date.now()}`,
    assetType: "subtitle",
    assetPath: "output/subtitle_generation/latest/subtitles.json",
    startMs: nextStartMs,
    durationMs: Math.max(1200, text.length * 110),
    text,
    style: "manual",
  };

  const hasTrack = timeline.tracks.some((track) => track.id === subtitleTrack.id);
  return {
    ...timeline,
    tracks: hasTrack
      ? timeline.tracks.map((track) =>
          track.id === subtitleTrack.id
            ? { ...track, clips: sortTimelineClips([...track.clips, nextClip]) }
            : track
        )
      : [...timeline.tracks, { ...subtitleTrack, clips: [nextClip] }],
  };
};

const addTimelineMarkerLocal = (
  timeline: TimelineData,
  marker: TimelineMarker
): TimelineData => ({
  ...timeline,
  markers: sortTimelineMarkers([
    ...timeline.markers.filter((current) => current.id !== marker.id),
    {
      ...marker,
      timeMs: clampNonNegativeInt(marker.timeMs),
      label: marker.label.trim(),
    },
  ]),
});

const splitTimelineClipLocal = (
  timeline: TimelineData,
  trackId: string,
  clipId: string,
  splitAtMs: number
): TimelineData => ({
  ...timeline,
  tracks: timeline.tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }
    const source = track.clips.find((clip) => clip.id === clipId);
    if (!source) {
      return track;
    }
    const boundedSplitAtMs = Math.max(
      source.startMs + 100,
      Math.min(splitAtMs, source.startMs + source.durationMs - 100)
    );
    if (
      boundedSplitAtMs <= source.startMs ||
      boundedSplitAtMs >= source.startMs + source.durationMs
    ) {
      return track;
    }
    const leftDurationMs = boundedSplitAtMs - source.startMs;
    const rightDurationMs = source.durationMs - leftDurationMs;
    const sourceInMs = source.inMs ?? 0;
    const sourceOutMs = source.outMs ?? sourceInMs + source.durationMs;
    const nextClipBaseId = `${source.id}-split-2`;
    let nextClipId = nextClipBaseId;
    let suffix = 3;
    while (track.clips.some((clip) => clip.id === nextClipId)) {
      nextClipId = `${source.id}-split-${suffix}`;
      suffix += 1;
    }
    return {
      ...track,
      clips: sortTimelineClips(
        track.clips.flatMap((clip) =>
          clip.id === clipId
            ? [
                {
                  ...clip,
                  durationMs: leftDurationMs,
                  outMs: Math.min(sourceOutMs, sourceInMs + leftDurationMs),
                },
                {
                  ...clip,
                  id: nextClipId,
                  startMs: boundedSplitAtMs,
                  durationMs: rightDurationMs,
                  inMs: sourceInMs + leftDurationMs,
                  outMs: sourceOutMs,
                },
              ]
            : [clip]
        )
      ),
    };
  }),
});

const findTimelineClip = (
  timeline: TimelineData | null,
  selectedClip: SelectedTimelineClip | null
): { track: TimelineTrack; clip: TimelineClip } | null => {
  if (!timeline || !selectedClip) {
    return null;
  }
  const track = timeline.tracks.find((candidate) => candidate.id === selectedClip.trackId);
  const clip = track?.clips.find((candidate) => candidate.id === selectedClip.clipId);
  return track && clip ? { track, clip } : null;
};

const getTimelineViewport = (
  timeline: TimelineData,
  playheadMs: number,
  zoomWindowMs: number
) => {
  const rangeStartMs = timeline.playbackRange.inMs;
  const rangeEndMs = timeline.playbackRange.outMs;
  const totalDurationMs = Math.max(1000, rangeEndMs - rangeStartMs);
  const viewportDurationMs = Math.min(
    totalDurationMs,
    Math.max(1200, clampPositiveInt(zoomWindowMs, 1200))
  );
  const clampedPlayheadMs = Math.min(
    rangeEndMs,
    Math.max(rangeStartMs, clampNonNegativeInt(playheadMs))
  );
  const centeredStartMs = clampedPlayheadMs - viewportDurationMs / 2;
  const maxStartMs = Math.max(rangeStartMs, rangeEndMs - viewportDurationMs);
  const viewportStartMs = Math.min(maxStartMs, Math.max(rangeStartMs, centeredStartMs));
  const viewportEndMs = viewportStartMs + viewportDurationMs;
  return {
    rangeStartMs,
    rangeEndMs,
    totalDurationMs,
    viewportStartMs,
    viewportEndMs,
    viewportDurationMs,
    clampedPlayheadMs,
  };
};

const getVisibleClipLayout = (
  clip: TimelineClip,
  viewport: ReturnType<typeof getTimelineViewport>
) => {
  const clipStartMs = clip.startMs;
  const clipEndMs = clip.startMs + clip.durationMs;
  const visibleStartMs = Math.max(clipStartMs, viewport.viewportStartMs);
  const visibleEndMs = Math.min(clipEndMs, viewport.viewportEndMs);
  if (visibleEndMs <= visibleStartMs) {
    return null;
  }
  return {
    leftPercent:
      ((visibleStartMs - viewport.viewportStartMs) / viewport.viewportDurationMs) * 100,
    widthPercent: Math.max(
      1.4,
      ((visibleEndMs - visibleStartMs) / viewport.viewportDurationMs) * 100
    ),
    trimmedLeft: visibleStartMs > clipStartMs,
    trimmedRight: visibleEndMs < clipEndMs,
  };
};

const getTimelineTickStepMs = (viewportDurationMs: number) => {
  if (viewportDurationMs <= 2500) {
    return 250;
  }
  if (viewportDurationMs <= 6000) {
    return 500;
  }
  if (viewportDurationMs <= 15000) {
    return 1000;
  }
  return 2000;
};

const formatTimelineTime = (timeMs: number) => `${(timeMs / 1000).toFixed(1)}s`;

const getTrackAccent = (trackType: string) => {
  if (trackType === "audio" || trackType === "bgm") {
    return {
      solid: "linear-gradient(120deg, rgba(34,197,94,0.88), rgba(74,222,128,0.8))",
      glow: "rgba(74, 222, 128, 0.32)",
    };
  }
  if (trackType === "subtitle") {
    return {
      solid: "linear-gradient(120deg, rgba(56,189,248,0.88), rgba(59,130,246,0.82))",
      glow: "rgba(96, 165, 250, 0.28)",
    };
  }
  return {
    solid: "linear-gradient(120deg, rgba(168,85,247,0.82), rgba(236,72,153,0.78))",
    glow: "rgba(216, 180, 254, 0.26)",
  };
};

const predictNextSplitClipId = (clips: TimelineClip[], sourceClipId: string) => {
  const baseId = `${sourceClipId}-split-2`;
  if (!clips.some((clip) => clip.id === baseId)) {
    return baseId;
  }
  let suffix = 3;
  while (clips.some((clip) => clip.id === `${sourceClipId}-split-${suffix}`)) {
    suffix += 1;
  }
  return `${sourceClipId}-split-${suffix}`;
};

const predictNextDuplicateClipId = (clips: TimelineClip[], sourceClipId: string) => {
  const baseId = `${sourceClipId}-copy`;
  if (!clips.some((clip) => clip.id === baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (clips.some((clip) => clip.id === `${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
};

const summarizeTimelineDraft = (timeline: TimelineData) => ({
  subtitleClipCount: timeline.tracks
    .filter((track) => track.type === "subtitle")
    .reduce((sum, track) => sum + track.clips.length, 0),
  audioClipCount: timeline.tracks
    .filter((track) => track.type === "audio" || track.type === "bgm")
    .reduce((sum, track) => sum + track.clips.length, 0),
  markerCount: timeline.markers.length,
});

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("dashboard");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    projectCount: 0,
    runningJobCount: 0,
    failedJobCount: 0,
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [scriptDraft, setScriptDraft] = useState<ScriptData>(initialScript);
  const [timelineDraft, setTimelineDraft] = useState<TimelineData | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [assetForm, setAssetForm] = useState({ type: "image", name: "", relativePath: "" });
  const [settings, setSettings] = useState<AppSettings>({
    apiKeys: {},
    outputPreset: { width: 1920, height: 1080, fps: 30 },
  });
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [wizardTheme, setWizardTheme] = useState("ゆっくり解説");
  const [wizardMode, setWizardMode] = useState("full");
  const [wizardTemplateId, setWizardTemplateId] = useState("");
  const [manualSubtitleText, setManualSubtitleText] = useState("");
  const [manualMarkerLabel, setManualMarkerLabel] = useState("調整ポイント");
  const [manualMarkerTimeMs, setManualMarkerTimeMs] = useState("0");
  const [selectedTimelineClip, setSelectedTimelineClip] = useState<SelectedTimelineClip | null>(null);
  const [timelinePlayheadMs, setTimelinePlayheadMs] = useState(0);
  const [timelineZoomWindowMs, setTimelineZoomWindowMs] = useState(6000);
  const [message, setMessage] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedClipDetail = useMemo(
    () => findTimelineClip(timelineDraft, selectedTimelineClip),
    [selectedTimelineClip, timelineDraft]
  );
  const timelineViewport = useMemo(
    () =>
      timelineDraft
        ? getTimelineViewport(timelineDraft, timelinePlayheadMs, timelineZoomWindowMs)
        : null,
    [timelineDraft, timelinePlayheadMs, timelineZoomWindowMs]
  );
  const timelineTicks = useMemo(() => {
    if (!timelineViewport) {
      return [];
    }
    const tickStepMs = getTimelineTickStepMs(timelineViewport.viewportDurationMs);
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

  useEffect(() => {
    void refreshDashboard();
    void loadSettings();
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTimelineClip && !findTimelineClip(timelineDraft, selectedTimelineClip)) {
      setSelectedTimelineClip(null);
    }
    if (!timelineDraft) {
      return;
    }
    setTimelinePlayheadMs((current) =>
      Math.min(
        timelineDraft.playbackRange.outMs,
        Math.max(timelineDraft.playbackRange.inMs, current)
      )
    );
  }, [selectedTimelineClip, timelineDraft]);

  const refreshDashboard = async () => {
    const [projectList, stats] = await Promise.all([
      fetchJson<ProjectSummary[]>("/api/projects"),
      fetchJson<DashboardStats>("/api/dashboard"),
    ]);
    setProjects(projectList);
    setDashboardStats(stats);
  };

  const loadProjectDetail = async (projectId: string) => {
    const detail = await fetchJson<ProjectDetail>(`/api/projects/${projectId}`);
    setSelectedProjectId(projectId);
    setProjectDetail(detail);
    setScriptDraft(detail.script ?? initialScript);
    setTimelineDraft(detail.timeline);
    setAssets(detail.assets ?? []);
    setPreview(null);
    setSelectedTimelineClip(null);
    setTimelinePlayheadMs(detail.timeline?.playbackRange.inMs ?? 0);
    setTimelineZoomWindowMs(
      Math.min(
        12000,
        Math.max(
          2400,
          (detail.timeline?.playbackRange.outMs ?? 6000) -
            (detail.timeline?.playbackRange.inMs ?? 0)
        )
      )
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
    const created = await fetchJson<{ jobId: string }>(`/api/projects/${selectedProjectId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: wizardMode, runMode: "resume" }),
    });
    setMessage(`レンダリングジョブを作成しました: ${created.jobId}`);
    await loadProjectDetail(selectedProjectId);
  };

  const saveScript = async () => {
    if (!selectedProjectId) return;
    await fetchJson<{ ok: boolean }>(`/api/projects/${selectedProjectId}/script`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scriptDraft),
    });
    setMessage("台本を保存しました");
    await loadProjectDetail(selectedProjectId);
  };

  const addAsset = async () => {
    if (!selectedProjectId) return;
    await fetchJson(`/api/projects/${selectedProjectId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assetForm),
    });
    setAssetForm({ type: "image", name: "", relativePath: "" });
    const nextAssets = await fetchJson<ProjectAsset[]>(`/api/projects/${selectedProjectId}/assets`);
    setAssets(nextAssets);
    setMessage("素材を登録しました");
  };

  const mutateTimelineDraft = (updater: (current: TimelineData) => TimelineData) => {
    setTimelineDraft((current) => (current ? updater(current) : current));
  };

  const saveTimelineAll = async () => {
    if (!selectedProjectId || !timelineDraft) return;
    await fetchJson(`/api/projects/${selectedProjectId}/timeline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(timelineDraft),
    });
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
    mutateTimelineDraft((current) => addManualSubtitleClipLocal(current, text, clipId));
    setSelectedTimelineClip({ trackId: "track-subtitle", clipId });
    setManualSubtitleText("");
    setMessage("手動テロップを追加しました。保存するとレンダリングに反映されます");
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
      })
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
    const nextClipId = predictNextSplitClipId(selectedClipDetail.track.clips, sourceClip.id);
    mutateTimelineDraft((current) =>
      splitTimelineClipLocal(
        current,
        selectedTimelineClip.trackId,
        selectedTimelineClip.clipId,
        timelinePlayheadMs
      )
    );
    setSelectedTimelineClip({
      trackId: selectedTimelineClip.trackId,
      clipId: nextClipId,
    });
    setMessage("プレイヘッド位置でクリップを分割しました。保存すると反映されます");
  };

  const nudgeSelectedTimelineClip = (deltaMs: number) => {
    if (!selectedTimelineClip || !selectedClipDetail) {
      setMessage("移動するクリップを選択してください");
      return;
    }
    mutateTimelineDraft((current) =>
      updateTimelineClipLocal(current, selectedTimelineClip.trackId, selectedTimelineClip.clipId, {
        startMs: selectedClipDetail.clip.startMs + deltaMs,
      })
    );
    setTimelinePlayheadMs(Math.max(0, selectedClipDetail.clip.startMs + deltaMs));
    setMessage(`${deltaMs > 0 ? "後ろ" : "前"}へ ${Math.abs(deltaMs)}ms 移動しました`);
  };

  const duplicateSelectedTimelineClip = () => {
    if (!selectedTimelineClip || !selectedClipDetail) {
      setMessage("複製するクリップを選択してください");
      return;
    }
    const nextClipId = predictNextDuplicateClipId(
      selectedClipDetail.track.clips,
      selectedClipDetail.clip.id
    );
    mutateTimelineDraft((current) =>
      duplicateTimelineClipLocal(current, selectedTimelineClip.trackId, selectedTimelineClip.clipId)
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
    mutateTimelineDraft((current) =>
      deleteTimelineClipLocal(current, selectedTimelineClip.trackId, selectedTimelineClip.clipId)
    );
    setSelectedTimelineClip(null);
    setMessage("選択中クリップを削除しました。保存すると反映されます");
  };

  const loadPreview = async () => {
    if (!selectedProjectId) return;
    const body = await fetchJson<PreviewResponse>(`/api/projects/${selectedProjectId}/preview`);
    setPreview(body);
  };

  const loadSettings = async () => {
    const loaded = await fetchJson<AppSettings>("/api/settings");
    setSettings(loaded);
  };

  const saveSettings = async () => {
    await fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
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
        name: `${scriptDraft.title || "新規"} テンプレート`,
        description: "Web GUIから作成",
        scriptSeed: { theme: scriptDraft.theme || wizardTheme },
        timelinePreset: timelineDraft,
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
          <strong data-testid="selected-project-id">{selectedProject?.id ?? "未選択"}</strong>
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

      <main style={styles.main}>
        {activeScreen === "dashboard" ? (
          <section style={styles.panel} data-testid="screen-dashboard">
            <h2 style={styles.panelTitle}>プロジェクト一覧</h2>
            <div style={styles.metricRow}>
              <Metric label="プロジェクト数" value={dashboardStats.projectCount} />
              <Metric label="実行中ジョブ" value={dashboardStats.runningJobCount} />
              <Metric label="失敗ジョブ" value={dashboardStats.failedJobCount} />
            </div>
            <button style={styles.secondaryButton} onClick={() => void refreshDashboard()}>
              最新化
            </button>
            <div style={styles.list}>
              {projects.map((project) => (
                <button
                  key={project.id}
                  style={styles.listItem}
                  onClick={() => {
                    void loadProjectDetail(project.id);
                    setActiveScreen("project");
                  }}
                >
                  <div>{project.theme ?? "(テーマ未設定)"}</div>
                  <small>{project.id}</small>
                  <small>最新ジョブ: {project.latestJob?.status ?? "なし"}</small>
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
              onChange={(event) => setWizardMode(event.target.value)}
            >
              <option value="full">full</option>
              <option value="scriptOnly">scriptOnly</option>
              <option value="renderOnly">renderOnly</option>
            </select>
            <label style={styles.label}>テンプレート</label>
            <select
              style={styles.input}
              value={wizardTemplateId}
              onChange={(event) => setWizardTemplateId(event.target.value)}
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
              onClick={() => void createProject()}
            >
              作成
            </button>
          </section>
        ) : null}

        {activeScreen === "project" ? (
          <section style={styles.panel} data-testid="screen-project">
            <h2 style={styles.panelTitle}>プロジェクト詳細</h2>
            {!projectDetail ? <div>プロジェクトを選択してください</div> : null}
            {projectDetail ? (
              <>
                <div style={styles.cardGrid}>
                  <InfoCard label="テーマ" value={projectDetail.project.theme ?? "未設定"} />
                  <InfoCard label="ステータス" value={projectDetail.project.status} />
                  <InfoCard label="ジョブ数" value={String(projectDetail.jobs.length)} />
                </div>
                <button style={styles.primaryButton} onClick={() => void createRenderJob()}>
                  再実行
                </button>
                <h3 style={styles.subTitle}>ジョブ履歴</h3>
                {projectDetail.jobs.map((job) => (
                  <div key={job.id} style={styles.jobCard}>
                    <strong>{job.id}</strong>
                    <div>{job.status}</div>
                    <div style={styles.stepWrap}>
                      {job.steps.map((step) => (
                        <span key={`${job.id}-${step.stepName}`} style={styles.stepBadge}>
                          {step.stepName}: {step.status}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <h3 style={styles.subTitle}>ログ</h3>
                <pre style={styles.logBox}>{(projectDetail.logs ?? []).join("\n")}</pre>
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
              onChange={(event) => setScriptDraft({ ...scriptDraft, title: event.target.value })}
            />
            <label style={styles.label}>テーマ</label>
            <input
              data-testid="script-theme-input"
              style={styles.input}
              value={scriptDraft.theme ?? ""}
              onChange={(event) => setScriptDraft({ ...scriptDraft, theme: event.target.value })}
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
                  lines: [...scriptDraft.lines, { speaker: "reimu", text: "" }],
                })
              }
            >
              行を追加
            </button>
            <button style={styles.primaryButton} data-testid="script-save-button" onClick={() => void saveScript()}>
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
                onChange={(event) => setAssetForm({ ...assetForm, type: event.target.value })}
              >
                <option value="image">image</option>
                <option value="audio">audio</option>
                <option value="video">video</option>
                <option value="subtitle">subtitle</option>
              </select>
              <input
                data-testid="asset-name-input"
                style={styles.inputSmall}
                placeholder="表示名"
                value={assetForm.name}
                onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })}
              />
              <input
                data-testid="asset-path-input"
                style={styles.input}
                placeholder="relativePath"
                value={assetForm.relativePath}
                onChange={(event) => setAssetForm({ ...assetForm, relativePath: event.target.value })}
              />
              <button style={styles.secondaryButton} data-testid="asset-add-button" onClick={() => void addAsset()}>
                登録
              </button>
            </div>
            <div style={styles.list} data-testid="asset-list">
              {assets.map((asset) => (
                <div key={asset.id} style={styles.assetRow}>
                  <strong>{asset.name}</strong>
                  <span>{asset.type}</span>
                  <small>{asset.relativePath}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeScreen === "timeline" ? (
          <section style={styles.panel} data-testid="screen-timeline">
            <h2 style={styles.panelTitle}>タイムライン編集</h2>
            {!timelineDraft ? <div>台本保存後にタイムラインを読み込めます。</div> : null}
            {timelineDraft ? (
              <>
                <div style={styles.timelineHeroGrid}>
                  <div style={styles.previewCard} data-testid="timeline-edit-summary">
                    <div>字幕クリップ: {summarizeTimelineDraft(timelineDraft).subtitleClipCount}</div>
                    <div>音声クリップ: {summarizeTimelineDraft(timelineDraft).audioClipCount}</div>
                    <div>マーカー: {summarizeTimelineDraft(timelineDraft).markerCount}</div>
                    {timelineViewport ? (
                      <div>
                        表示窓: {formatTimelineTime(timelineViewport.viewportStartMs)} -{" "}
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
                              inMs: clampNonNegativeInt(Number(event.target.value)),
                              outMs: Math.max(
                                clampNonNegativeInt(Number(event.target.value)),
                                current.playbackRange.outMs
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
                                clampNonNegativeInt(Number(event.target.value))
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
                        value={timelineViewport?.clampedPlayheadMs ?? timelineDraft.playbackRange.inMs}
                        onChange={(event) => setTimelinePlayheadMs(Number(event.target.value))}
                      />
                      <span>{formatTimelineTime(timelineViewport?.clampedPlayheadMs ?? 0)}</span>
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
                          timelineDraft.playbackRange.outMs - timelineDraft.playbackRange.inMs
                        )}
                        value={Math.min(
                          timelineZoomWindowMs,
                          Math.max(
                            1200,
                            timelineDraft.playbackRange.outMs - timelineDraft.playbackRange.inMs
                          )
                        )}
                        onChange={(event) => setTimelineZoomWindowMs(Number(event.target.value))}
                      />
                      <span>{formatTimelineTime(timelineZoomWindowMs)}</span>
                    </div>
                  </div>
                </div>
                <div style={styles.timelineWorkspace}>
                  <div style={styles.timelineVisualPanel} data-testid="timeline-visual-editor">
                    <div style={styles.timelineRuler}>
                      {timelineTicks.map((tickMs) => (
                        <div
                          key={`tick-${tickMs}`}
                          style={{
                            ...styles.timelineTick,
                            left: `${(((tickMs - (timelineViewport?.viewportStartMs ?? 0)) /
                              (timelineViewport?.viewportDurationMs ?? 1)) *
                              100).toFixed(3)}%`,
                          }}
                        >
                          <span style={styles.timelineTickLabel}>{formatTimelineTime(tickMs)}</span>
                        </div>
                      ))}
                      {timelineViewport
                        ? timelineDraft.markers
                            .filter(
                              (marker) =>
                                marker.timeMs >= timelineViewport.viewportStartMs &&
                                marker.timeMs <= timelineViewport.viewportEndMs
                            )
                            .map((marker) => (
                              <div
                                key={marker.id}
                                style={{
                                  ...styles.timelineMarkerLine,
                                  left: `${(((marker.timeMs - timelineViewport.viewportStartMs) /
                                    timelineViewport.viewportDurationMs) *
                                    100).toFixed(3)}%`,
                                }}
                                title={`${marker.label} ${marker.timeMs}ms`}
                              />
                            ))
                        : null}
                      {timelineViewport ? (
                        <div
                          style={{
                            ...styles.timelinePlayheadLine,
                            left: `${(((timelineViewport.clampedPlayheadMs -
                              timelineViewport.viewportStartMs) /
                              timelineViewport.viewportDurationMs) *
                              100).toFixed(3)}%`,
                          }}
                        />
                      ) : null}
                    </div>
                    {timelineDraft.tracks.map((track) => {
                      const accent = getTrackAccent(track.type);
                      return (
                        <div key={`visual-${track.id}`} style={styles.timelineLane}>
                          <div style={styles.timelineLaneHeader}>
                            <strong>{track.name}</strong>
                            <small>{track.type}</small>
                          </div>
                          <div style={styles.timelineLaneCanvas}>
                            {timelineViewport ? (
                              <div
                                style={{
                                  ...styles.timelinePlayheadLine,
                                  left: `${(((timelineViewport.clampedPlayheadMs -
                                    timelineViewport.viewportStartMs) /
                                    timelineViewport.viewportDurationMs) *
                                    100).toFixed(3)}%`,
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
                                  onClick={() => selectTimelineClip(track.id, clip.id)}
                                  style={{
                                    ...styles.timelineClipBlock,
                                    left: `${layout.leftPercent}%`,
                                    width: `${layout.widthPercent}%`,
                                    background: accent.solid,
                                    boxShadow: isSelected
                                      ? `0 0 0 2px rgba(255,255,255,0.88), 0 14px 26px ${accent.glow}`
                                      : `0 10px 22px ${accent.glow}`,
                                    opacity: layout.trimmedLeft || layout.trimmedRight ? 0.85 : 1,
                                  }}
                                  title={`${clip.id} ${clip.startMs}ms - ${clip.startMs + clip.durationMs}ms`}
                                >
                                  <span style={styles.timelineClipTitle}>{clip.id}</span>
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
                  <aside style={styles.timelineInspector} data-testid="timeline-selected-clip">
                    <div style={styles.timelineInspectorHeader}>選択中クリップ</div>
                    {selectedClipDetail ? (
                      <>
                        <strong>
                          {selectedClipDetail.track.name} / {selectedClipDetail.clip.id}
                        </strong>
                        <small>
                          {selectedClipDetail.clip.startMs}ms -{" "}
                          {selectedClipDetail.clip.startMs + selectedClipDetail.clip.durationMs}ms
                        </small>
                        <div style={styles.stepWrap}>
                          <span style={styles.stepBadge}>{selectedClipDetail.track.type}</span>
                          {selectedClipDetail.clip.style ? (
                            <span style={styles.stepBadge}>{selectedClipDetail.clip.style}</span>
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
                          <button style={styles.secondaryButton} onClick={() => nudgeSelectedTimelineClip(-100)}>
                            -100ms
                          </button>
                          <button style={styles.secondaryButton} onClick={() => nudgeSelectedTimelineClip(100)}>
                            +100ms
                          </button>
                        </div>
                        <div style={styles.lineRow}>
                          <button style={styles.secondaryButton} onClick={duplicateSelectedTimelineClip}>
                            複製
                          </button>
                          <button style={styles.secondaryButton} onClick={deleteSelectedTimelineClip}>
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
                                }
                              )
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
                                }
                              )
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
                                    }
                                  )
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
                                    }
                                  )
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
                                    }
                                  )
                                )
                              }
                            />
                            <div style={styles.lineRow}>
                              <div style={styles.compactField}>
                                <label style={styles.labelInline}>fade in</label>
                                <input
                                  style={styles.inputSmall}
                                  type="number"
                                  value={selectedClipDetail.clip.fadeInMs ?? 0}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        selectedClipDetail.track.id,
                                        selectedClipDetail.clip.id,
                                        {
                                          fadeInMs: Number(event.target.value),
                                        }
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div style={styles.compactField}>
                                <label style={styles.labelInline}>fade out</label>
                                <input
                                  style={styles.inputSmall}
                                  type="number"
                                  value={selectedClipDetail.clip.fadeOutMs ?? 0}
                                  onChange={(event) =>
                                    mutateTimelineDraft((current) =>
                                      updateTimelineClipLocal(
                                        current,
                                        selectedClipDetail.track.id,
                                        selectedClipDetail.clip.id,
                                        {
                                          fadeOutMs: Number(event.target.value),
                                        }
                                      )
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <div>レーン上のクリップをクリックすると詳細編集できます。</div>
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
                        onChange={(event) => setManualSubtitleText(event.target.value)}
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
                        onChange={(event) => setManualMarkerLabel(event.target.value)}
                      />
                      <input
                        data-testid="timeline-marker-time-input"
                        style={styles.inputSmall}
                        type="number"
                        placeholder="timeMs"
                        value={manualMarkerTimeMs}
                        onChange={(event) => setManualMarkerTimeMs(event.target.value)}
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
                                duplicateTimelineClipLocal(current, track.id, clip.id)
                              );
                              setSelectedTimelineClip({
                                trackId: track.id,
                                clipId: predictNextDuplicateClipId(track.clips, clip.id),
                              });
                            }}
                          >
                            複製
                          </button>
                          <button
                            style={styles.secondaryButton}
                            data-testid={`timeline-delete-${track.id}-${clip.id}`}
                            onClick={() => {
                              mutateTimelineDraft((current) =>
                                deleteTimelineClipLocal(current, track.id, clip.id)
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
                            onClick={() => selectTimelineClip(track.id, clip.id)}
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
                            max={Math.max(12000, timelineDraft.playbackRange.outMs + 1000)}
                            value={clip.startMs}
                            onChange={(event) =>
                              mutateTimelineDraft((current) =>
                                updateTimelineClipLocal(current, track.id, clip.id, {
                                  startMs: Number(event.target.value),
                                })
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
                                updateTimelineClipLocal(current, track.id, clip.id, {
                                  durationMs: Number(event.target.value),
                                })
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
                                  updateTimelineClipLocal(current, track.id, clip.id, {
                                    text: event.target.value,
                                  })
                                )
                              }
                            />
                            <input
                              style={styles.inputSmall}
                              value={clip.style ?? ""}
                              onChange={(event) =>
                                mutateTimelineDraft((current) =>
                                  updateTimelineClipLocal(current, track.id, clip.id, {
                                    style: event.target.value,
                                  })
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
                                  updateTimelineClipLocal(current, track.id, clip.id, {
                                    volume: Number(event.target.value),
                                  })
                                )
                              }
                            />
                            <input
                              style={styles.inputSmall}
                              type="number"
                              value={clip.fadeInMs ?? 0}
                              onChange={(event) =>
                                mutateTimelineDraft((current) =>
                                  updateTimelineClipLocal(current, track.id, clip.id, {
                                    fadeInMs: Number(event.target.value),
                                  })
                                )
                              }
                            />
                            <input
                              style={styles.inputSmall}
                              type="number"
                              value={clip.fadeOutMs ?? 0}
                              onChange={(event) =>
                                mutateTimelineDraft((current) =>
                                  updateTimelineClipLocal(current, track.id, clip.id, {
                                    fadeOutMs: Number(event.target.value),
                                  })
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
                  onClick={() => void saveTimelineAll()}
                >
                  タイムライン保存
                </button>
                <button style={styles.secondaryButton} onClick={() => void createTemplateFromCurrent()}>
                  テンプレート化
                </button>
              </>
            ) : null}
          </section>
        ) : null}

        {activeScreen === "preview" ? (
          <section style={styles.panel} data-testid="screen-preview">
            <h2 style={styles.panelTitle}>プレビュー & レンダリング</h2>
            <button style={styles.secondaryButton} data-testid="preview-load-button" onClick={() => void loadPreview()}>
              プレビュー情報を取得
            </button>
            <button
              style={styles.primaryButton}
              data-testid="preview-render-button"
              onClick={() => void createRenderJob()}
            >
              レンダリング実行
            </button>
            {preview ? (
              <div style={styles.previewCard} data-testid="preview-summary">
                <div>durationInFrames: {preview.remotionProps.durationInFrames}</div>
                <div>durationMs: {preview.remotionProps.durationMs}</div>
                <div>字幕クリップ数: {preview.remotionProps.subtitleTracks.length}</div>
                <div>音声クリップ数: {preview.remotionProps.audioTracks.length}</div>
                <div data-testid="preview-manual-summary">
                  手動編集: 字幕 {preview.remotionProps.manualEditSummary.subtitleClipCount} / 音声{" "}
                  {preview.remotionProps.manualEditSummary.audioClipCount} / マーカー{" "}
                  {preview.remotionProps.manualEditSummary.markerCount} / トリム{" "}
                  {preview.remotionProps.manualEditSummary.playbackRangeApplied ? "あり" : "なし"}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeScreen === "settings" ? (
          <section style={styles.panel} data-testid="screen-settings">
            <h2 style={styles.panelTitle}>設定</h2>
            <div style={styles.lineRow}>
              <label style={styles.labelInline}>Google API Key</label>
              <input
                data-testid="settings-google-input"
                style={styles.input}
                value={settings.apiKeys.google ?? ""}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    apiKeys: { ...settings.apiKeys, google: event.target.value },
                  })
                }
              />
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
            <button style={styles.primaryButton} data-testid="settings-save-button" onClick={() => void saveSettings()}>
              保存
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={styles.metricCard}>
    <div>{label}</div>
    <strong style={styles.metricValue}>{value}</strong>
  </div>
);

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.infoCard}>
    <small>{label}</small>
    <strong>{value}</strong>
  </div>
);

const styleText = `
:root {
  --bg: #0a101f;
  --panel: rgba(12, 24, 49, 0.78);
  --line: rgba(132, 204, 255, 0.22);
  --fg: #f8fafc;
  --accent: #22d3ee;
  --accent-strong: #0ea5e9;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: radial-gradient(circle at 10% 20%, #14264d 0%, #090f1e 55%, #050914 100%);
  color: var(--fg);
  font-family: "BIZ UDPGothic", "Yu Gothic UI", "Hiragino Kaku Gothic ProN", sans-serif;
}
.tab, .tab-active {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(15, 30, 60, 0.4);
  color: var(--fg);
  cursor: pointer;
  transition: transform 180ms ease, background 180ms ease;
}
.tab:hover, .tab-active:hover {
  transform: translateY(-1px);
}
.tab-active {
  background: linear-gradient(120deg, var(--accent-strong), var(--accent));
  color: #062029;
  font-weight: 700;
}
@media (max-width: 900px) {
  .tab, .tab-active {
    flex: 1 0 44%;
  }
}
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 18px 40px",
    position: "relative",
    overflow: "hidden",
  },
  backgroundShapeOne: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(34,211,238,0.35), rgba(14,165,233,0.03) 70%)",
    pointerEvents: "none",
  },
  backgroundShapeTwo: {
    position: "absolute",
    bottom: -220,
    left: -120,
    width: 480,
    height: 480,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(56,189,248,0.25), rgba(14,165,233,0.01) 70%)",
    pointerEvents: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    position: "relative",
    zIndex: 2,
  },
  kicker: {
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    opacity: 0.7,
    fontSize: 12,
  },
  title: {
    margin: "4px 0 0",
    fontSize: "clamp(24px, 3.5vw, 36px)",
  },
  statusCard: {
    border: "1px solid rgba(148, 226, 255, 0.28)",
    borderRadius: 18,
    padding: "12px 16px",
    minWidth: 240,
    background: "rgba(15, 30, 60, 0.52)",
    display: "grid",
    gap: 4,
  },
  navBar: {
    marginTop: 16,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    position: "relative",
    zIndex: 2,
  },
  message: {
    marginTop: 14,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(34,211,238,0.42)",
    background: "rgba(8, 47, 73, 0.58)",
  },
  main: {
    marginTop: 18,
    position: "relative",
    zIndex: 2,
  },
  panel: {
    border: "1px solid rgba(148, 226, 255, 0.2)",
    background: "rgba(7, 20, 44, 0.72)",
    borderRadius: 18,
    padding: 20,
    display: "grid",
    gap: 12,
  },
  panelTitle: {
    margin: 0,
    fontSize: 24,
  },
  subTitle: {
    margin: "8px 0 0",
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  metricCard: {
    border: "1px solid rgba(34, 211, 238, 0.2)",
    borderRadius: 12,
    padding: "12px 14px",
    background: "rgba(12, 34, 67, 0.6)",
    display: "grid",
    gap: 4,
  },
  metricValue: {
    fontSize: 28,
  },
  list: {
    display: "grid",
    gap: 8,
  },
  listItem: {
    textAlign: "left",
    border: "1px solid rgba(148,226,255,0.22)",
    background: "rgba(11, 28, 57, 0.72)",
    color: "#f8fafc",
    borderRadius: 12,
    padding: "12px 14px",
    display: "grid",
    gap: 4,
    cursor: "pointer",
  },
  label: {
    fontSize: 13,
    opacity: 0.85,
  },
  labelInline: {
    fontSize: 12,
    opacity: 0.8,
  },
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(148,226,255,0.26)",
    background: "rgba(6, 17, 37, 0.8)",
    color: "#f8fafc",
    padding: "9px 11px",
  },
  inputSmall: {
    borderRadius: 10,
    border: "1px solid rgba(148,226,255,0.26)",
    background: "rgba(6, 17, 37, 0.8)",
    color: "#f8fafc",
    padding: "9px 11px",
    minWidth: 110,
  },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "10px 16px",
    background: "linear-gradient(120deg, #22d3ee, #38bdf8)",
    color: "#072532",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(148,226,255,0.28)",
    borderRadius: 12,
    padding: "9px 14px",
    background: "rgba(9, 30, 61, 0.72)",
    color: "#f8fafc",
    cursor: "pointer",
    width: "fit-content",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  infoCard: {
    border: "1px solid rgba(148,226,255,0.2)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
    background: "rgba(10, 30, 60, 0.7)",
  },
  jobCard: {
    border: "1px solid rgba(148,226,255,0.2)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
    background: "rgba(9, 24, 50, 0.68)",
  },
  stepWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  stepBadge: {
    border: "1px solid rgba(148,226,255,0.24)",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
  },
  logBox: {
    margin: 0,
    borderRadius: 12,
    border: "1px solid rgba(148,226,255,0.2)",
    background: "rgba(2, 8, 23, 0.9)",
    padding: 12,
    maxHeight: 220,
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },
  lineRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  assetRow: {
    border: "1px solid rgba(148,226,255,0.18)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "grid",
    gap: 3,
  },
  timelineHeroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  timelineWorkspace: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
    alignItems: "start",
  },
  timelineVisualPanel: {
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 16,
    background: "rgba(4, 16, 34, 0.82)",
    padding: 14,
    display: "grid",
    gap: 10,
    overflowX: "auto",
  },
  timelineRuler: {
    position: "relative",
    height: 34,
    borderRadius: 10,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(13,23,42,0.72) 100%)",
    border: "1px solid rgba(148,226,255,0.12)",
    overflow: "hidden",
  },
  timelineTick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    background: "rgba(148,226,255,0.18)",
  },
  timelineTickLabel: {
    position: "absolute",
    top: 6,
    left: 6,
    fontSize: 11,
    color: "rgba(226, 232, 240, 0.86)",
    whiteSpace: "nowrap",
  },
  timelineMarkerLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    background: "rgba(250, 204, 21, 0.9)",
    boxShadow: "0 0 12px rgba(250, 204, 21, 0.42)",
  },
  timelinePlayheadLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    background: "rgba(248, 113, 113, 0.95)",
    boxShadow: "0 0 12px rgba(248, 113, 113, 0.45)",
    pointerEvents: "none",
  },
  timelineLane: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: 10,
    alignItems: "stretch",
  },
  timelineLaneHeader: {
    borderRadius: 12,
    border: "1px solid rgba(148,226,255,0.14)",
    padding: "10px 12px",
    background: "rgba(8, 20, 43, 0.78)",
    display: "grid",
    gap: 4,
    alignContent: "center",
  },
  timelineLaneCanvas: {
    position: "relative",
    minHeight: 72,
    borderRadius: 12,
    border: "1px solid rgba(148,226,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(7,20,44,0.92) 0%, rgba(5,14,28,0.92) 100%)",
    overflow: "hidden",
  },
  timelineClipBlock: {
    position: "absolute",
    top: 10,
    bottom: 10,
    border: "none",
    borderRadius: 12,
    padding: "8px 10px",
    color: "#eff6ff",
    display: "grid",
    gap: 3,
    textAlign: "left",
    cursor: "pointer",
    minWidth: 30,
    overflow: "hidden",
  },
  timelineClipTitle: {
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  timelineClipSubtitle: {
    fontSize: 11,
    opacity: 0.92,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  timelineInspector: {
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 16,
    background: "rgba(7, 20, 44, 0.78)",
    padding: 14,
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  timelineInspectorHeader: {
    fontSize: 18,
    fontWeight: 700,
  },
  timelineUtilityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  timelineUtilityCard: {
    border: "1px solid rgba(148,226,255,0.16)",
    borderRadius: 14,
    background: "rgba(8, 20, 43, 0.72)",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  compactField: {
    display: "grid",
    gap: 6,
    minWidth: 120,
  },
  timelineTrack: {
    border: "1px solid rgba(148,226,255,0.18)",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
    background: "rgba(9, 30, 60, 0.55)",
  },
  clipEditor: {
    borderRadius: 10,
    border: "1px solid rgba(148,226,255,0.16)",
    background: "rgba(5, 18, 38, 0.6)",
    padding: "8px 10px",
    display: "grid",
    gap: 6,
  },
  sliderRow: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 80px",
    gap: 8,
    alignItems: "center",
  },
  slider: {
    width: "100%",
  },
  previewCard: {
    border: "1px solid rgba(148,226,255,0.22)",
    borderRadius: 12,
    padding: "12px 14px",
    display: "grid",
    gap: 6,
    background: "rgba(6, 25, 48, 0.64)",
  },
};
