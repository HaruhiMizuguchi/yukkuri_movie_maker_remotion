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
  tracks: Array<{ id: string; name: string; type: string; clips: TimelineClip[] }>;
  markers: Array<{ id: string; timeMs: number; label: string }>;
};

type ProjectAsset = {
  id: string;
  type: string;
  name: string;
  relativePath: string;
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

test("制作開始からレンダリング準備までの顧客導線を可視化できる", async ({ page }, testInfo) => {
  const visual = createVisualEvidenceRecorder(testInfo);

  await page.goto("/");
  await expect(page.getByTestId("screen-dashboard")).toBeVisible();
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
  await expect(page.getByTestId("selected-project-id")).toContainText(projectId);
  await visual.capture(page, "03-project-created", "プロジェクト詳細", [
    "作成直後のプロジェクトが選択状態になる",
    "ジョブ数とステータスが確認できる",
  ]);

  await page.getByTestId("nav-script").click();
  await page.getByTestId("script-title-input").fill("AIニュース解説テスト");
  await page.getByTestId("script-theme-input").fill("AIニュース解説");
  await page.getByTestId("script-line-text-0").fill("今日は生成AIのニュースを短く紹介します。");
  await page.getByTestId("script-line-text-1").fill("編集と確認まで一気に進めるぜ。");
  await page.getByTestId("script-save-button").click();
  await expect(page.getByRole("status")).toContainText("台本を保存しました");
  await visual.capture(page, "04-script-saved", "台本編集", [
    "タイトル・テーマ・セリフを編集して保存できる",
    "保存後も入力内容が画面に残る",
  ]);

  await page.getByTestId("nav-assets").click();
  await page.getByTestId("asset-name-input").fill("検証背景");
  await page.getByTestId("asset-path-input").fill("projects/demo/input/assets/background.png");
  await page.getByTestId("asset-add-button").click();
  await expect(page.getByTestId("asset-list")).toContainText("検証背景");
  await visual.capture(page, "05-assets", "素材管理", [
    "素材名・種別・パスを登録できる",
    "登録済み素材が一覧で確認できる",
  ]);

  await page.getByTestId("nav-timeline").click();
  await expect(page.getByTestId("screen-timeline")).toContainText("字幕");
  await page.getByTestId("timeline-out-input").fill("9000");
  await page.getByTestId("timeline-save-button").click();
  await expect(page.getByRole("status")).toContainText("タイムラインを保存しました");
  await visual.capture(page, "06-timeline", "タイムライン編集", [
    "台本から生成された音声・字幕トラックが見える",
    "再生範囲を編集して保存できる",
  ]);

  await page.getByTestId("nav-preview").click();
  await page.getByTestId("preview-load-button").click();
  await expect(page.getByTestId("preview-summary")).toContainText("durationInFrames");
  await page.getByTestId("preview-render-button").click();
  await expect(page.getByRole("status")).toContainText("レンダリングジョブを作成しました");
  await visual.capture(page, "07-preview-render", "プレビューとレンダリング", [
    "Remotion向けプレビュー情報を確認できる",
    "同じ画面からレンダリングジョブを作成できる",
  ]);

  await page.getByTestId("nav-settings").click();
  await page.getByTestId("settings-google-input").fill("dummy-google-key-for-e2e");
  await page.getByTestId("settings-width-input").fill("1280");
  await page.getByTestId("settings-height-input").fill("720");
  await page.getByTestId("settings-save-button").click();
  await expect(page.getByRole("status")).toContainText("設定を保存しました");
  await visual.capture(page, "08-settings", "設定", [
    "APIキーと出力プリセットを保存できる",
    "制作導線の最後に外部連携前提を確認できる",
  ]);

  await visual.writeManifest();
});

const installCustomerJourneyApiMock = async (page: Page) => {
  const state = {
    theme: "",
    script: null as ScriptData | null,
    timeline: null as TimelineData | null,
    assets: [] as ProjectAsset[],
    jobs: [] as Array<{ id: string; status: string; mode: string; createdAt: string }>,
    settings: {
      apiKeys: {},
      outputPreset: { width: 1920, height: 1080, fps: 30 },
    },
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData() ?? "{}") : {};
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
          : []
      );
    }

    if (url.pathname === "/api/projects" && method === "POST") {
      state.theme = String(body.theme ?? "AIニュース解説");
      return fulfillJson({ projectId, theme: state.theme, mode: body.mode ?? "full" }, 201);
    }

    if (url.pathname === `/api/projects/${projectId}` && method === "GET") {
      return fulfillJson(createProjectDetail(state));
    }

    if (url.pathname === `/api/projects/${projectId}/script` && method === "PUT") {
      state.script = body as ScriptData;
      state.timeline = createTimelineFromScript(state.script);
      return fulfillJson({ ok: true });
    }

    if (url.pathname === `/api/projects/${projectId}/assets` && method === "GET") {
      return fulfillJson(state.assets);
    }

    if (url.pathname === `/api/projects/${projectId}/assets` && method === "POST") {
      const asset = {
        id: "asset-customer-journey-1",
        type: String(body.type ?? "image"),
        name: String(body.name ?? "asset"),
        relativePath: String(body.relativePath ?? "projects/demo/input/assets/background.png"),
        createdAt,
      };
      state.assets = [asset];
      return fulfillJson({ ok: true, assetId: asset.id, relativePath: asset.relativePath }, 201);
    }

    if (url.pathname === `/api/projects/${projectId}/timeline/operations` && method === "POST") {
      state.timeline = applyTimelineOperation(state.timeline, body);
      return fulfillJson(state.timeline);
    }

    if (url.pathname === `/api/projects/${projectId}/timeline` && method === "PUT") {
      state.timeline = body as TimelineData;
      return fulfillJson({ ok: true });
    }

    if (url.pathname === `/api/projects/${projectId}/preview` && method === "GET") {
      const timeline = state.timeline ?? createTimelineFromScript(state.script ?? defaultScript());
      return fulfillJson({
        timeline,
        remotionProps: {
          durationInFrames: Math.ceil((timeline.playbackRange.outMs / 1000) * 30),
          subtitleTracks: timeline.tracks
            .flatMap((track) => track.clips)
            .filter((clip) => clip.assetType === "subtitle")
            .map((clip) => ({
              text: clip.text ?? "",
              startMs: clip.startMs,
              endMs: clip.startMs + clip.durationMs,
            })),
        },
      });
    }

    if (url.pathname === `/api/projects/${projectId}/jobs` && method === "POST") {
      state.jobs = [{ id: jobId, status: "PENDING", mode: String(body.mode ?? "full"), createdAt }];
      return fulfillJson({ projectId, jobId }, 201);
    }

    if (url.pathname === "/api/settings" && method === "GET") {
      return fulfillJson(state.settings);
    }

    if (url.pathname === "/api/settings" && method === "PUT") {
      state.settings = body;
      return fulfillJson({ ok: true });
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
}) => ({
  project: { id: projectId, theme: state.theme, status: "PENDING" },
  ownerId: "e2e-user",
  jobs: state.jobs.map((job) => ({
    ...job,
    steps: [],
    files: [],
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
  operation: Record<string, unknown>
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

const createVisualEvidenceRecorder = (testInfo: TestInfo) => {
  const runId =
    process.env.E2E_RUN_ID ??
    new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 15);
  const projectName = testInfo.project.name.replace(/[^a-z0-9-]/gi, "_");
  const evidenceRoot = path.join(
    process.cwd(),
    "outputs",
    "test_evidence",
    "customer_journey",
    runId,
    projectName
  );
  const checkpoints: VisualCheckpoint[] = [];

  return {
    async capture(
      page: Page,
      id: string,
      label: string,
      expectedObservations: string[]
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
        screenshotPath: toPortablePath(path.relative(process.cwd(), screenshotPath)),
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
      const manifestPath = path.join(evidenceRoot, "visual-regression-manifest.json");
      await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
      await fs.writeFile(
        path.join(evidenceRoot, "ai-visual-review-prompt.md"),
        buildAiVisualReviewPrompt(manifest),
        "utf-8"
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
        `- ${checkpoint.id} ${checkpoint.label}: ${checkpoint.screenshotPath}\n  期待: ${checkpoint.expectedObservations.join(" / ")}`
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

const toPortablePath = (targetPath: string): string => targetPath.replaceAll("\\", "/");
