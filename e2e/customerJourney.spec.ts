import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

type ScriptLine = {
  speaker: string;
  text: string;
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

type TimelineData = {
  playbackRange: { inMs: number; outMs: number };
  tracks: Array<{
    id: string;
    name: string;
    type: string;
    clips: TimelineClip[];
  }>;
  markers: Array<{ id: string; timeMs: number; label: string }>;
};

type ProjectAsset = {
  id: string;
  type: string;
  name: string;
  relativePath: string;
  usage?: string;
  createdAt: string;
};

type VisualCheckpoint = {
  id: string;
  label: string;
  screenshotPath: string;
  expectedObservations: string[];
};

const projectId = "00000000-0000-4000-8000-000000000001";
const jobId = "00000000-0000-4000-8000-000000000101";
const createdAt = "2026-04-16T00:00:00.000Z";

test.beforeEach(async ({ page }) => {
  await installCustomerJourneyApiMock(page);
});

test("制作開始からレンダリング準備までの顧客導線を可視化できる", async ({
  page,
}, testInfo) => {
  const visual = createVisualEvidenceRecorder(testInfo);

  await page.goto("/");
  await expect(page.getByTestId("screen-dashboard")).toBeVisible();
  await expect(page.getByTestId("dashboard-create-button")).toContainText(
    "新しい動画を作る",
  );
  await expect(page.getByLabel("動画制作の流れ")).toContainText("確認・出力");
  await visual.capture(page, "01-dashboard", "ダッシュボード", [
    "プロジェクト数・実行中ジョブ・失敗ジョブの状態が確認できる",
    "作成前なのでプロジェクト一覧は空に見える",
  ]);

  await page.getByTestId("nav-wizard").click();
  await page.getByTestId("wizard-theme-input").fill("AIニュース解説");
  await page.getByTestId("wizard-mode-select").selectOption("full");
  await visual.capture(page, "02-wizard", "作成ウィザード", [
    "テーマと生成モードを指定して制作を開始できる",
    "テンプレート未指定でも作成できる",
  ]);

  await page.getByTestId("wizard-create-button").click();
  await expect(page.getByTestId("screen-project")).toBeVisible();
  await expect(page.getByTestId("selected-project-id")).toHaveAttribute(
    "data-project-id",
    projectId,
  );
  await visual.capture(page, "03-project-created", "プロジェクト詳細", [
    "作成直後のプロジェクトが選択状態になる",
    "ジョブ数とステータスが確認できる",
  ]);

  await page.getByTestId("nav-script").click();
  await page.getByTestId("script-title-input").fill("AIニュース解説テスト");
  await page.getByTestId("script-theme-input").fill("AIニュース解説");
  await page
    .getByTestId("script-line-text-0")
    .fill("今日は生成AIのニュースを短く紹介します。");
  await page
    .getByTestId("script-line-text-1")
    .fill("編集と確認まで一気に進めるぜ。");
  await page.getByTestId("script-save-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "台本を保存しました",
  );
  await expect(page.getByTestId("screen-assets")).toBeVisible();
  await visual.capture(page, "04-script-saved", "台本編集", [
    "タイトル・テーマ・セリフを編集して保存できる",
    "保存後も入力内容が画面に残る",
  ]);

  await page.getByTestId("nav-assets").click();
  await page.getByTestId("asset-usage-select").selectOption("background");
  await page.getByTestId("asset-name-input").fill("検証背景");
  await page.getByTestId("asset-file-input").setInputFiles({
    name: "background.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await page.getByTestId("asset-add-button").click();
  await expect(page.getByTestId("asset-list")).toContainText("検証背景");
  await visual.capture(page, "05-assets", "素材管理", [
    "素材名・種別・パスを登録できる",
    "登録済み素材が一覧で確認できる",
  ]);

  await page.getByTestId("nav-timeline").click();
  await expect(page.getByTestId("screen-timeline")).toContainText("字幕");
  await page.getByTestId("timeline-out-input").fill("4500");
  await page
    .getByTestId("timeline-manual-subtitle-input")
    .fill("仕上げ用の手動テロップです。");
  await page.getByTestId("timeline-add-subtitle-button").click();
  await page.getByTestId("timeline-clip-block-track-subtitle-sub-2").click();
  await page.getByTestId("timeline-playhead-input").fill("2600");
  await page.getByTestId("timeline-split-button").click();
  await expect(page.getByTestId("timeline-selected-clip")).toContainText(
    "sub-2-split-2",
  );
  await page.getByTestId("timeline-marker-label-input").fill("見せ場");
  await page.getByTestId("timeline-marker-time-input").fill("4200");
  await page.getByTestId("timeline-add-marker-button").click();
  await page.getByTestId("timeline-save-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "タイムラインを保存しました",
  );
  await expect(page.getByTestId("screen-preview")).toBeVisible();
  await visual.capture(page, "06-timeline", "タイムライン編集", [
    "視覚タイムラインからクリップ選択と分割ができる",
    "手動テロップとマーカーを追加して保存できる",
  ]);

  await page.getByTestId("nav-preview").click();
  await page.getByTestId("preview-load-button").click();
  await expect(page.getByTestId("preview-summary")).toContainText(
    "durationInFrames",
  );
  await expect(page.getByTestId("preview-manual-summary")).toContainText(
    "トリム あり",
  );
  await expect(page.getByTestId("preview-manual-summary")).toContainText(
    "字幕 4",
  );
  await page.getByTestId("preview-render-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "完成動画の生成を開始しました",
  );
  await expect(page.getByTestId("preview-summary")).toContainText(
    "durationInFrames",
  );
  await visual.capture(page, "07-preview-render", "プレビューとレンダリング", [
    "Remotion向けプレビュー情報を確認できる",
    "手動編集サマリーがプレビュー画面で確認できる",
    "同じ画面からレンダリングジョブを作成できる",
  ]);

  await page.getByTestId("nav-settings").click();
  await page.getByTestId("settings-diagnostics-button").click();
  await expect(page.getByTestId("settings-google-status")).toContainText(
    "設定済み",
  );
  await page.getByTestId("settings-width-input").fill("1280");
  await page.getByTestId("settings-height-input").fill("720");
  await page.getByTestId("settings-save-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "設定を保存しました",
  );
  await visual.capture(page, "08-settings", "設定", [
    "環境変数ベースのAPI接続状態を確認できる",
    "出力プリセットを保存できる",
  ]);

  await visual.writeManifest();
});

const installCustomerJourneyApiMock = async (page: Page) => {
  const state = {
    theme: "",
    script: null as ScriptData | null,
    timeline: null as TimelineData | null,
    assets: [] as ProjectAsset[],
    jobs: [] as Array<{
      id: string;
      status: string;
      mode: string;
      createdAt: string;
    }>,
    settings: {
      apiKeys: {},
      outputPreset: { width: 1920, height: 1080, fps: 30 },
    },
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const rawBody = request.postData() ?? "";
    const contentType = request.headers()["content-type"] ?? "";
    const body = contentType.includes("application/json")
      ? JSON.parse(rawBody || "{}")
      : Object.fromEntries(
          Array.from(rawBody.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)).map(
            (match) => [match[1], match[2]],
          ),
        );
    const fulfillJson = (payload: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });

    if (url.pathname === "/api/dashboard" && method === "GET") {
      return fulfillJson({
        projectCount: state.theme ? 1 : 0,
        runningJobCount: 0,
        failedJobCount: 0,
      });
    }

    if (url.pathname === "/api/projects" && method === "GET") {
      return fulfillJson(
        state.theme
          ? [
              {
                id: projectId,
                theme: state.theme,
                status: "PENDING",
                createdAt,
                updatedAt: createdAt,
                latestJob: state.jobs[0] ?? null,
              },
            ]
          : [],
      );
    }

    if (url.pathname === "/api/projects" && method === "POST") {
      state.theme = String(body.theme ?? "AIニュース解説");
      return fulfillJson(
        { projectId, theme: state.theme, mode: body.mode ?? "full" },
        201,
      );
    }

    if (url.pathname === `/api/projects/${projectId}` && method === "GET") {
      return fulfillJson(createProjectDetail(state));
    }

    if (
      url.pathname === `/api/projects/${projectId}/script` &&
      method === "PUT"
    ) {
      state.script = body as ScriptData;
      state.timeline = createTimelineFromScript(state.script);
      return fulfillJson({ ok: true });
    }

    if (
      url.pathname === `/api/projects/${projectId}/assets` &&
      method === "GET"
    ) {
      return fulfillJson(state.assets);
    }

    if (
      url.pathname === `/api/projects/${projectId}/assets` &&
      method === "POST"
    ) {
      const asset = {
        id: "asset-customer-journey-1",
        type: String(body.type ?? "image"),
        name: String(body.name ?? "asset"),
        usage: String(body.usage ?? "background"),
        relativePath: String(
          body.relativePath ??
            `projects/${projectId}/input/assets/backgrounds/background.png`,
        ),
        createdAt,
      };
      state.assets = [asset];
      return fulfillJson(
        { ok: true, assetId: asset.id, relativePath: asset.relativePath },
        201,
      );
    }

    if (
      url.pathname ===
        `/api/projects/${projectId}/assets/asset-customer-journey-1/file` &&
      method === "GET"
    ) {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    }

    if (
      url.pathname === `/api/projects/${projectId}/timeline/operations` &&
      method === "POST"
    ) {
      state.timeline = applyTimelineOperation(state.timeline, body);
      return fulfillJson(state.timeline);
    }

    if (
      url.pathname === `/api/projects/${projectId}/timeline` &&
      method === "PUT"
    ) {
      state.timeline = body as TimelineData;
      return fulfillJson({ ok: true });
    }

    if (
      url.pathname === `/api/projects/${projectId}/preview` &&
      method === "GET"
    ) {
      const timeline =
        state.timeline ??
        createTimelineFromScript(state.script ?? defaultScript());
      return fulfillJson({
        timeline,
        outputPreset: state.settings.outputPreset,
        remotionProps: buildPreviewRemotionProps(timeline),
      });
    }

    if (
      url.pathname === `/api/projects/${projectId}/jobs` &&
      method === "POST"
    ) {
      state.jobs = [
        {
          id: jobId,
          status: "PENDING",
          mode: String(body.mode ?? "full"),
          createdAt,
        },
      ];
      return fulfillJson({ projectId, jobId }, 201);
    }

    if (
      url.pathname.startsWith(`/api/jobs/${jobId}/files/`) &&
      method === "GET"
    ) {
      return route.fulfill({
        status: 200,
        contentType: "video/mp4",
        body: Buffer.from([]),
      });
    }

    if (url.pathname === "/api/settings" && method === "GET") {
      return fulfillJson(state.settings);
    }

    if (url.pathname === "/api/settings" && method === "PUT") {
      state.settings = body;
      return fulfillJson({ ok: true });
    }

    if (
      url.pathname === `/api/projects/${projectId}/settings` &&
      method === "GET"
    ) {
      return fulfillJson(state.settings);
    }

    if (
      url.pathname === `/api/projects/${projectId}/settings` &&
      method === "PUT"
    ) {
      state.settings = body;
      return fulfillJson({ ok: true });
    }

    if (url.pathname === "/api/settings/diagnostics" && method === "GET") {
      return fulfillJson({
        googleApiKey: { configured: true },
        aivisSpeech: { configured: true, reachable: true, status: 200 },
      });
    }

    if (url.pathname === "/api/templates" && method === "GET") {
      return fulfillJson([]);
    }

    if (url.pathname === "/api/templates" && method === "POST") {
      return fulfillJson({ ok: true, id: body.id }, 201);
    }

    return fulfillJson({ error: `unhandled ${method} ${url.pathname}` }, 404);
  });
};

const createProjectDetail = (state: {
  theme: string;
  script: ScriptData | null;
  timeline: TimelineData | null;
  assets: ProjectAsset[];
  jobs: Array<{ id: string; status: string; mode: string; createdAt: string }>;
  settings: {
    apiKeys: Record<string, string>;
    outputPreset: { width: number; height: number; fps: number };
  };
}) => ({
  project: {
    id: projectId,
    theme: state.theme,
    status: "PENDING",
    automationMode: "full",
    settingsJson: state.settings,
  },
  ownerId: "e2e-user",
  jobs: state.jobs.map((job) => ({
    ...job,
    steps: [
      {
        stepName: "script_generation",
        status: "COMPLETED",
        completedAt: createdAt,
      },
      {
        stepName: "video_composition",
        status: "COMPLETED",
        completedAt: createdAt,
      },
      {
        stepName: "final_encoding",
        status: "COMPLETED",
        completedAt: createdAt,
      },
    ],
    files: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        relativePath: `projects/${projectId}/output/video_composition/latest/preview.mp4`,
        fileType: "video",
        fileCategory: "output",
      },
      {
        id: "00000000-0000-4000-8000-000000000202",
        relativePath: `projects/${projectId}/final/final.mp4`,
        fileType: "video",
        fileCategory: "final",
      },
    ],
  })),
  script: state.script,
  timeline: state.timeline,
  assets: state.assets,
  logs: ["customer journey e2e mock log"],
});

const defaultScript = (): ScriptData => ({
  title: "AIニュース解説テスト",
  theme: "AIニュース解説",
  lines: [
    { speaker: "reimu", text: "今日は生成AIのニュースを短く紹介します。" },
    { speaker: "marisa", text: "編集と確認まで一気に進めるぜ。" },
  ],
});

const createTimelineFromScript = (script: ScriptData): TimelineData => {
  let cursor = 0;
  const subtitleClips = script.lines.map((line, index) => {
    const durationMs = Math.max(1200, line.text.length * 100);
    const clip = {
      id: `sub-${index + 1}`,
      assetType: "subtitle",
      assetPath: "output/subtitle_generation/latest/subtitles.json",
      startMs: cursor,
      durationMs,
      text: line.text,
      style: line.speaker,
    };
    cursor += durationMs;
    return clip;
  });
  const totalDuration = Math.max(cursor, 5000);
  return {
    playbackRange: { inMs: 0, outMs: totalDuration },
    markers: [{ id: "mk-start", timeMs: 0, label: "start" }],
    tracks: [
      {
        id: "track-audio",
        name: "音声",
        type: "audio",
        clips: [
          {
            id: "audio-main",
            assetType: "audio",
            assetPath: "output/tts_generation/latest/audio.wav",
            startMs: 0,
            durationMs: totalDuration,
          },
        ],
      },
      {
        id: "track-subtitle",
        name: "字幕",
        type: "subtitle",
        clips: subtitleClips,
      },
    ],
  };
};

const applyTimelineOperation = (
  current: TimelineData | null,
  operation: Record<string, unknown>,
): TimelineData => {
  const timeline = current ?? createTimelineFromScript(defaultScript());
  if (operation.operation === "playbackRange") {
    return {
      ...timeline,
      playbackRange: {
        inMs: Number(operation.inMs),
        outMs: Number(operation.outMs),
      },
    };
  }
  return timeline;
};

const buildPreviewRemotionProps = (timeline: TimelineData) => {
  const rangeIn = timeline.playbackRange.inMs;
  const rangeOut = timeline.playbackRange.outMs;
  const normalizeClip = (clip: TimelineClip) => {
    const clipEnd = clip.startMs + clip.durationMs;
    const clippedStart = Math.max(clip.startMs, rangeIn);
    const clippedEnd = Math.min(clipEnd, rangeOut);
    if (clippedEnd <= clippedStart) {
      return null;
    }
    return {
      ...clip,
      startMs: clippedStart - rangeIn,
      endMs: clippedEnd - rangeIn,
    };
  };

  const subtitleTracks = timeline.tracks
    .filter((track) => track.type === "subtitle")
    .flatMap((track) =>
      track.clips
        .map(normalizeClip)
        .filter(
          (clip): clip is TimelineClip & { endMs: number } => clip !== null,
        )
        .map((clip) => ({
          text: clip.text ?? "",
          startMs: clip.startMs,
          endMs: clip.endMs,
        })),
    );

  const audioTracks = timeline.tracks
    .filter((track) => track.type === "audio" || track.type === "bgm")
    .flatMap((track) =>
      track.clips
        .map(normalizeClip)
        .filter(
          (clip): clip is TimelineClip & { endMs: number } => clip !== null,
        )
        .map((clip) => ({
          clipId: clip.id,
          startMs: clip.startMs,
          endMs: clip.endMs,
        })),
    );

  const markers = timeline.markers
    .filter((marker) => marker.timeMs >= rangeIn && marker.timeMs <= rangeOut)
    .map((marker) => ({
      ...marker,
      timeMs: marker.timeMs - rangeIn,
    }));

  const maxTrackEnd = Math.max(
    0,
    ...timeline.tracks.flatMap((track) =>
      track.clips.map((clip) => clip.startMs + clip.durationMs),
    ),
  );

  return {
    durationInFrames: Math.ceil(((rangeOut - rangeIn) / 1000) * 30),
    durationMs: rangeOut - rangeIn,
    subtitleTracks,
    audioTracks,
    markers,
    manualEditSummary: {
      subtitleClipCount: subtitleTracks.length,
      audioClipCount: audioTracks.length,
      markerCount: markers.length,
      playbackRangeApplied: rangeIn > 0 || rangeOut < maxTrackEnd,
    },
  };
};

const createVisualEvidenceRecorder = (testInfo: TestInfo) => {
  const runId =
    process.env.E2E_RUN_ID ??
    new Date()
      .toISOString()
      .replace(/[-:.]/g, "")
      .replace("T", "-")
      .slice(0, 15);
  const projectName = testInfo.project.name.replace(/[^a-z0-9-]/gi, "_");
  const evidenceRoot = path.join(
    process.cwd(),
    "outputs",
    "test_evidence",
    "customer_journey",
    runId,
    projectName,
  );
  const checkpoints: VisualCheckpoint[] = [];

  return {
    async capture(
      page: Page,
      id: string,
      label: string,
      expectedObservations: string[],
    ): Promise<void> {
      await fs.mkdir(evidenceRoot, { recursive: true });
      const screenshotPath = path.join(evidenceRoot, `${id}.png`);
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(100);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: "disabled",
        caret: "hide",
      });
      checkpoints.push({
        id,
        label,
        screenshotPath: toPortablePath(
          path.relative(process.cwd(), screenshotPath),
        ),
        expectedObservations,
      });
      await testInfo.attach(`${id}-${label}`, {
        path: screenshotPath,
        contentType: "image/png",
      });
    },
    async writeManifest(): Promise<void> {
      await fs.mkdir(evidenceRoot, { recursive: true });
      const manifest = {
        kind: "customer_journey_visual_regression",
        createdAt: new Date().toISOString(),
        projectName: testInfo.project.name,
        viewport: testInfo.project.use.viewport,
        checkpoints,
        reviewPolicy: {
          failCandidates: [
            "主要な導線ボタンが見えない",
            "日本語テキストが親要素からはみ出している",
            "保存・作成などの状態メッセージが確認できない",
            "タイムライン・プレビューなど成果物確認画面が空に見える",
          ],
        },
      };
      const manifestPath = path.join(
        evidenceRoot,
        "visual-regression-manifest.json",
      );
      await fs.writeFile(
        manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf-8",
      );
      await fs.writeFile(
        path.join(evidenceRoot, "ai-visual-review-prompt.md"),
        buildAiVisualReviewPrompt(manifest),
        "utf-8",
      );
      await testInfo.attach("visual-regression-manifest", {
        path: manifestPath,
        contentType: "application/json",
      });
    },
  };
};

const buildAiVisualReviewPrompt = (manifest: {
  checkpoints: VisualCheckpoint[];
  reviewPolicy: { failCandidates: string[] };
}): string => {
  const checkpoints = manifest.checkpoints
    .map(
      (checkpoint) =>
        `- ${checkpoint.id} ${checkpoint.label}: ${checkpoint.screenshotPath}\n  期待: ${checkpoint.expectedObservations.join(" / ")}`,
    )
    .join("\n");
  const failCandidates = manifest.reviewPolicy.failCandidates
    .map((candidate) => `- ${candidate}`)
    .join("\n");
  return `# AIビジュアル回帰レビュー用プロンプト

以下のスクリーンショットを顧客導線順に確認し、前回の良品または期待状態と比べてUI上の退行を指摘してください。

## チェックポイント
${checkpoints}

## 失敗候補
${failCandidates}

## 出力形式
- 重大度
- 対象チェックポイント
- 観察した差分
- ユーザー影響
- 下位テストへ落とすべき観点
`;
};

const toPortablePath = (targetPath: string): string =>
  targetPath.replaceAll("\\", "/");
