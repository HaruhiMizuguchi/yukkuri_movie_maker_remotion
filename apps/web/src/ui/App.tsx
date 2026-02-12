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
  text?: string;
  style?: string;
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
  markers: Array<{ id: string; timeMs: number; label: string }>;
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
    subtitleTracks: Array<{ text: string; startMs: number; endMs: number }>;
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
  const [message, setMessage] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    void refreshDashboard();
    void loadSettings();
    void loadTemplates();
  }, []);

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

  const applyTimelineOperation = async (payload: Record<string, unknown>) => {
    if (!selectedProjectId) return;
    const updated = await fetchJson<TimelineData>(
      `/api/projects/${selectedProjectId}/timeline/operations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setTimelineDraft(updated);
  };

  const saveTimelineAll = async () => {
    if (!selectedProjectId || !timelineDraft) return;
    await fetchJson(`/api/projects/${selectedProjectId}/timeline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(timelineDraft),
    });
    setMessage("タイムラインを保存しました");
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
          <strong>{selectedProject?.id ?? "未選択"}</strong>
          <small>{selectedProject?.theme ?? "テーマ未設定"}</small>
        </div>
      </header>

      <nav style={styles.navBar}>
        {screens.map((screen) => (
          <button
            key={screen.id}
            onClick={() => setActiveScreen(screen.id)}
            className={screen.id === activeScreen ? "tab-active" : "tab"}
          >
            {screen.label}
          </button>
        ))}
      </nav>

      {message ? <div style={styles.message}>{message}</div> : null}

      <main style={styles.main}>
        {activeScreen === "dashboard" ? (
          <section style={styles.panel}>
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
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>プロジェクト作成ウィザード</h2>
            <label style={styles.label}>テーマ</label>
            <input
              style={styles.input}
              value={wizardTheme}
              onChange={(event) => setWizardTheme(event.target.value)}
            />
            <label style={styles.label}>モード</label>
            <select style={styles.input} value={wizardMode} onChange={(event) => setWizardMode(event.target.value)}>
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
            <button style={styles.primaryButton} onClick={() => void createProject()}>
              作成
            </button>
          </section>
        ) : null}

        {activeScreen === "project" ? (
          <section style={styles.panel}>
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
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>台本編集</h2>
            <label style={styles.label}>タイトル</label>
            <input
              style={styles.input}
              value={scriptDraft.title ?? ""}
              onChange={(event) => setScriptDraft({ ...scriptDraft, title: event.target.value })}
            />
            <label style={styles.label}>テーマ</label>
            <input
              style={styles.input}
              value={scriptDraft.theme ?? ""}
              onChange={(event) => setScriptDraft({ ...scriptDraft, theme: event.target.value })}
            />
            <h3 style={styles.subTitle}>セリフ</h3>
            {scriptDraft.lines.map((line, index) => (
              <div key={`line-${index}`} style={styles.lineRow}>
                <input
                  style={styles.inputSmall}
                  value={line.speaker}
                  onChange={(event) => {
                    const lines = [...scriptDraft.lines];
                    lines[index] = { ...line, speaker: event.target.value };
                    setScriptDraft({ ...scriptDraft, lines });
                  }}
                />
                <input
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
              onClick={() =>
                setScriptDraft({
                  ...scriptDraft,
                  lines: [...scriptDraft.lines, { speaker: "reimu", text: "" }],
                })
              }
            >
              行を追加
            </button>
            <button style={styles.primaryButton} onClick={() => void saveScript()}>
              保存
            </button>
          </section>
        ) : null}

        {activeScreen === "assets" ? (
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>素材管理</h2>
            <div style={styles.lineRow}>
              <select
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
                style={styles.inputSmall}
                placeholder="表示名"
                value={assetForm.name}
                onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })}
              />
              <input
                style={styles.input}
                placeholder="relativePath"
                value={assetForm.relativePath}
                onChange={(event) => setAssetForm({ ...assetForm, relativePath: event.target.value })}
              />
              <button style={styles.secondaryButton} onClick={() => void addAsset()}>
                登録
              </button>
            </div>
            <div style={styles.list}>
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
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>タイムライン編集</h2>
            {!timelineDraft ? <div>台本保存後にタイムラインを読み込めます。</div> : null}
            {timelineDraft ? (
              <>
                <div style={styles.lineRow}>
                  <label style={styles.labelInline}>in</label>
                  <input
                    style={styles.inputSmall}
                    type="number"
                    value={timelineDraft.playbackRange.inMs}
                    onChange={(event) =>
                      void applyTimelineOperation({
                        operation: "playbackRange",
                        inMs: Number(event.target.value),
                        outMs: timelineDraft.playbackRange.outMs,
                      })
                    }
                  />
                  <label style={styles.labelInline}>out</label>
                  <input
                    style={styles.inputSmall}
                    type="number"
                    value={timelineDraft.playbackRange.outMs}
                    onChange={(event) =>
                      void applyTimelineOperation({
                        operation: "playbackRange",
                        inMs: timelineDraft.playbackRange.inMs,
                        outMs: Number(event.target.value),
                      })
                    }
                  />
                </div>
                {timelineDraft.tracks.map((track) => (
                  <div key={track.id} style={styles.timelineTrack}>
                    <h3 style={styles.subTitle}>{track.name}</h3>
                    {track.clips.map((clip) => (
                      <div key={clip.id} style={styles.clipEditor}>
                        <div>{clip.id}</div>
                        <div style={styles.sliderRow}>
                          <span>開始</span>
                          <input
                            style={styles.slider}
                            type="range"
                            min={0}
                            max={Math.max(12000, timelineDraft.playbackRange.outMs + 1000)}
                            value={clip.startMs}
                            onChange={(event) =>
                              void applyTimelineOperation({
                                operation: "move",
                                trackId: track.id,
                                clipId: clip.id,
                                newStartMs: Number(event.target.value),
                              })
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
                              void applyTimelineOperation({
                                operation: "resize",
                                trackId: track.id,
                                clipId: clip.id,
                                newDurationMs: Number(event.target.value),
                              })
                            }
                          />
                          <span>{clip.durationMs}ms</span>
                        </div>
                        {clip.text ? <small>{clip.text}</small> : null}
                      </div>
                    ))}
                  </div>
                ))}
                <button style={styles.primaryButton} onClick={() => void saveTimelineAll()}>
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
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>プレビュー & レンダリング</h2>
            <button style={styles.secondaryButton} onClick={() => void loadPreview()}>
              プレビュー情報を取得
            </button>
            <button style={styles.primaryButton} onClick={() => void createRenderJob()}>
              レンダリング実行
            </button>
            {preview ? (
              <div style={styles.previewCard}>
                <div>durationInFrames: {preview.remotionProps.durationInFrames}</div>
                <div>字幕クリップ数: {preview.remotionProps.subtitleTracks.length}</div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeScreen === "settings" ? (
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>設定</h2>
            <div style={styles.lineRow}>
              <label style={styles.labelInline}>Google API Key</label>
              <input
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
            <button style={styles.primaryButton} onClick={() => void saveSettings()}>
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
