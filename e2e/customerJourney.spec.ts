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
  inMs?: number;
  outMs?: number;
  volume?: number;
  text?: string;
  style?: string;
};

type TimelineData = {
  editingMode?: "source" | "final-video";
  playbackRange: { inMs: number; outMs: number };
  tracks: Array<{
    id: string;
    name: string;
    type: string;
    hidden?: boolean;
    muted?: boolean;
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

  const automaticJobRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/projects/${projectId}/jobs`,
    { timeout: 3_000 },
  );
  await page.getByTestId("wizard-create-button").click();
  const automaticJobRequest = await automaticJobRequestPromise;
  expect(automaticJobRequest.postDataJSON()).toMatchObject({
    mode: "full",
    runMode: "resume",
  });
  await expect(page.getByTestId("screen-project")).toBeVisible();
  await expect(page.getByTestId("selected-project-id")).toHaveAttribute(
    "data-project-id",
    projectId,
  );
  await expect(page.getByTestId("app-message")).toContainText(
    "全自動で完成動画の生成を開始しました",
  );
  await expect(page.getByTestId("generation-monitor")).toContainText(
    "生成を受け付けました",
  );
  await visual.capture(page, "03-project-created", "プロジェクト詳細", [
    "作成直後のプロジェクトが選択状態になる",
    "ジョブ数とステータスが確認できる",
  ]);

  await page.getByTestId("nav-wizard").click();
  await expect(page.getByTestId("screen-wizard")).toBeVisible();
  await expect(page.getByTestId("selected-project-id")).toContainText(
    "新しい動画を作成中",
  );
  await expect(page.getByTestId("selected-project-id")).not.toHaveAttribute(
    "data-project-id",
  );
  await expect(page.getByTestId("wizard-theme-input")).toHaveValue("");
  await expect(page.getByTestId("nav-script")).toBeDisabled();
  await expect(page.getByTestId("generation-monitor")).toHaveCount(0);

  await page.getByTestId("nav-dashboard").click();
  await page.getByRole("button", { name: "AIニュース解説を開く" }).click();
  await expect(page.getByTestId("screen-project")).toBeVisible();
  await expect(page.getByTestId("selected-project-id")).toHaveAttribute(
    "data-project-id",
    projectId,
  );
  await expect(page.getByTestId("ai-usage-summary")).toContainText(
    "AI使用量と料金目安",
  );
  await expect(page.getByTestId("ai-usage-summary")).toContainText("約 ￥32");
  await expect(page.getByTestId("ai-usage-summary")).toContainText(
    "gemini-2.5-flash",
  );
  await expect(page.getByTestId("ai-usage-latest")).toContainText("直近の実行");

  await page.getByText("再実行・工程・成果物の詳細").click();
  await page.getByTestId("project-rerun-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "完成動画の生成を開始しました",
  );
  await page.getByTestId("nav-script").click();
  await expect(page.getByTestId("script-editor-workspace")).toBeVisible();
  await expect(page.getByTestId("script-summary")).toContainText(
    "読み上げ目安",
  );
  await expect(page.getByTestId("script-dirty-status")).toContainText(
    "保存済み",
  );
  const pollingRefresh = page.waitForRequest(
    (request) =>
      request.method() === "GET" &&
      new URL(request.url()).pathname === `/api/projects/${projectId}`,
  );
  await page.getByTestId("script-title-input").fill("AIニュース解説テスト");
  await pollingRefresh;
  await expect(page.getByTestId("script-title-input")).toHaveValue(
    "AIニュース解説テスト",
  );
  await page.getByTestId("script-theme-input").fill("AIニュース解説");
  await page
    .getByTestId("script-line-text-0")
    .fill("今日は生成AIのニュースを短く紹介します。");
  await page
    .getByTestId("script-line-text-1")
    .fill("編集と確認まで一気に進めるぜ。");
  await expect(page.getByTestId("script-dirty-status")).toContainText("未保存");
  await page.getByTestId("script-duplicate-line-0").click();
  await expect(page.getByTestId("script-line-card")).toHaveCount(3);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("script-delete-line-1").click();
  await expect(page.getByTestId("script-line-card")).toHaveCount(2);
  await visual.capture(page, "04-script-editor", "台本編集", [
    "行数・文字数・読み上げ時間と未保存状態が確認できる",
    "セリフを行単位で複製・並べ替え・削除できる",
  ]);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("nav-assets").click();
  await expect(page.getByTestId("screen-script")).toBeVisible();
  await page.getByTestId("script-save-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "台本を保存しました",
  );
  await expect(page.getByTestId("screen-assets")).toBeVisible();
  await expect(page.getByTestId("asset-upload-workspace")).toBeVisible();
  await expect(page.getByTestId("asset-library-summary")).toContainText("0件");
  await visual.capture(page, "04-script-saved", "素材管理の空状態", [
    "台本保存後に素材管理へ進める",
    "素材がなくても自動生成で次へ進めることが分かる",
  ]);

  await page.getByTestId("nav-assets").click();
  await page.getByTestId("asset-file-input").setInputFiles({
    name: "unsupported.exe",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("not-an-asset"),
  });
  await expect(page.getByTestId("asset-upload-error")).toContainText(
    "対応していない",
  );
  await expect(page.getByTestId("asset-add-button")).toBeDisabled();
  await page.getByTestId("asset-file-input").setInputFiles({
    name: "検証背景.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByTestId("asset-upload-error")).toHaveCount(0);
  await expect(page.getByTestId("asset-type-select")).toHaveValue("image");
  await expect(page.getByTestId("asset-usage-select")).toHaveValue(
    "background",
  );
  await expect(page.getByTestId("asset-name-input")).toHaveValue("検証背景");
  await page.getByTestId("asset-add-button").click();
  await expect(page.getByTestId("asset-card")).toHaveCount(1);
  await expect(page.getByTestId("asset-library-summary")).toContainText("1件");
  await visual.capture(page, "05-assets", "素材管理", [
    "ドラッグ＆ドロップと対応形式が日本語で分かる",
    "用途別サマリーとプレビュー付き素材カードを確認できる",
  ]);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByTestId("asset-remove-button-asset-customer-journey-1")
    .click();
  await expect(page.getByTestId("asset-card")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByTestId("asset-remove-button-asset-customer-journey-1")
    .click();
  await expect(page.getByTestId("asset-card")).toHaveCount(0);

  await page.getByTestId("nav-timeline").click();
  await expect(page.getByTestId("screen-timeline")).toContainText("字幕");
  await expect(page.getByTestId("timeline-studio-workspace")).toBeVisible();
  await expect(page.getByTestId("timeline-preview-panel")).toContainText(
    "編集モニター",
  );
  await expect(page.getByTestId("timeline-track-area")).toBeVisible();
  await expect(page.getByTestId("timeline-inspector-panel")).toContainText(
    "クリップ設定",
  );
  await expect(page.getByRole("slider", { name: "再生位置" })).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "タイムラインの表示範囲" }),
  ).toBeVisible();
  await expect(page.getByTestId("timeline-shortcut-help")).toContainText(
    "Space",
  );
  await page.getByTestId("timeline-out-input").fill("4500");
  await page
    .getByTestId("timeline-manual-subtitle-input")
    .fill("仕上げ用の手動テロップです。");
  await page.getByTestId("timeline-add-subtitle-button").click();
  await page.getByTestId("timeline-clip-block-track-subtitle-sub-2").click();
  await page.getByTestId("timeline-playhead-input").fill("2500");
  await page.getByTestId("timeline-shortcut-help").click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("timeline-playhead-input")).toHaveValue("2600");
  await page.keyboard.press("s");
  await expect(page.getByTestId("timeline-selected-clip")).toContainText(
    "sub-2-split-2",
  );
  await page.getByTestId("timeline-marker-label-input").fill("見せ場");
  await page.getByTestId("timeline-marker-time-input").fill("4200");
  await page.getByTestId("timeline-add-marker-button").click();
  await visual.capture(page, "06-timeline", "タイムライン編集", [
    "視覚タイムラインからクリップ選択と分割ができる",
    "手動テロップとマーカーを追加して保存できる",
  ]);
  await page.getByTestId("timeline-save-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "タイムラインを保存しました",
  );
  await expect(page.getByTestId("screen-preview")).toBeVisible();
  await expect(page.getByTestId("delivery-review-workspace")).toBeVisible();

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
  await expect(page.getByTestId("preview-quality-summary")).toContainText(
    "4 / 4",
  );
  const reviewWarning = page.waitForEvent("dialog");
  const reviewClick = page.getByTestId("preview-render-button").click();
  const reviewDialog = await reviewWarning;
  expect(reviewDialog.message()).toContain("目視確認が4項目残っています");
  await reviewDialog.dismiss();
  await reviewClick;
  await expect(page.getByTestId("preview-render-button")).toBeEnabled();
  for (const reviewId of ["picture", "subtitle", "audio", "rights"]) {
    await page.getByTestId(`delivery-review-${reviewId}`).check();
  }
  await expect(page.getByTestId("manual-review-summary")).toContainText(
    "4 / 4",
  );
  await page.getByTestId("preview-render-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "完成動画の生成を開始しました",
  );
  await expect(page.getByTestId("generation-monitor")).toContainText(
    "生成を受け付けました",
  );
  await expect(page.getByTestId("generation-current-step")).toContainText(
    "開始を待っています",
  );
  await expect(page.getByTestId("generation-progress-count")).toContainText(
    "自動更新中",
  );
  await expect(page.getByTestId("preview-summary")).toContainText(
    "durationInFrames",
  );
  await expect(page.getByTestId("preview-render-button")).toBeDisabled();
  await expect(page.getByTestId("preview-render-button")).toContainText(
    "生成中",
  );
  await expect(page.getByTestId("delivery-status")).toContainText(
    "新しい完成版を生成中",
  );
  await expect(page.getByTestId("delivery-download-card")).toContainText(
    "前回版",
  );
  await visual.capture(page, "07-preview-render", "プレビューとレンダリング", [
    "自動品質チェックと手動レビューを分けて確認できる",
    "新版生成中と前回の完成動画を明確に区別できる",
    "生成中は二重ジョブ投入が無効になる",
  ]);

  await page.getByTestId("nav-timeline").click();
  await page.getByTestId("timeline-import-final-button").click();
  await expect(page.getByTestId("screen-timeline")).toContainText(
    "完成動画編集モード",
  );
  await expect(
    page.getByTestId("timeline-clip-block-track-final-video-final-video-main"),
  ).toBeVisible();
  await page
    .getByTestId("timeline-clip-block-track-final-video-final-video-main")
    .click();
  await expect(
    page.getByTestId("timeline-track-header-track-final-video"),
  ).toBeInViewport();
  await page.getByTestId("timeline-playhead-input").fill("2000");
  await page.getByTestId("timeline-split-button").click();
  await expect(page.getByTestId("timeline-selected-clip")).toContainText(
    "final-video-main-split-2",
  );
  // 実際のポーリングを2回通し、未保存の分割・選択・再生位置・履歴を保持する。
  const selectedBeforePoll = await page
    .getByTestId("timeline-selected-clip")
    .textContent();
  const playheadBeforePoll = await page
    .getByTestId("timeline-playhead-input")
    .inputValue();
  for (let count = 0; count < 2; count++) {
    await page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === `/api/projects/${projectId}`,
    );
  }
  await expect(page.getByTestId("timeline-selected-clip")).toHaveText(
    selectedBeforePoll!,
  );
  await expect(page.getByTestId("timeline-playhead-input")).toHaveValue(
    playheadBeforePoll,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("timeline-ripple-delete-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "後続映像を前へ詰めました",
  );
  await visual.capture(page, "08-final-video-editor", "完成動画編集", [
    "完成済み動画を編集専用トラックへ取り込める",
    "プレイヘッド分割と削除して詰める操作ができる",
    "元の字幕と音声が二重にならない無効状態を確認できる",
  ]);

  await page.getByTestId("nav-settings").click();
  await expect(page.getByTestId("settings-google-status")).toContainText(
    "未設定",
  );
  await page
    .getByTestId("settings-script-model-select")
    .selectOption("claude-sonnet-5");
  await page
    .getByTestId("settings-image-model-select")
    .selectOption("gpt-image-2");
  await expect(page.getByTestId("settings-dirty-status")).toContainText(
    "未保存",
  );
  await expect(
    page.locator(
      '[data-testid="settings-script-model-select"] option[value="gpt-5.6-terra"]',
    ),
  ).toHaveCount(1);
  await page
    .getByTestId("settings-google-key-input")
    .fill("e2e-google-api-key");
  await page.getByTestId("settings-google-key-save").click();
  await expect(page.getByTestId("settings-google-key-input")).toHaveValue("");
  await expect(page.getByTestId("settings-google-status")).toContainText(
    "保存済み",
  );
  await page
    .getByTestId("settings-openai-key-input")
    .fill("e2e-openai-api-key");
  await page.getByTestId("settings-openai-key-save").click();
  await expect(page.getByTestId("settings-openai-status")).toContainText(
    "保存済み",
  );
  await page
    .getByTestId("settings-anthropic-key-input")
    .fill("e2e-anthropic-api-key");
  await page.getByTestId("settings-anthropic-key-save").click();
  await expect(page.getByTestId("settings-anthropic-status")).toContainText(
    "保存済み",
  );
  await page.getByTestId("settings-diagnostics-button").click();
  await expect(page.getByTestId("settings-google-status")).toContainText(
    "接続OK",
  );
  await expect(page.getByTestId("settings-openai-status")).toContainText(
    "接続OK",
  );
  await expect(page.getByTestId("settings-anthropic-status")).toContainText(
    "接続OK",
  );
  await page.getByTestId("settings-fps-input").fill("0");
  await expect(page.getByTestId("settings-validation")).toContainText(
    "FPSは1〜120",
  );
  await expect(page.getByTestId("settings-save-button")).toBeDisabled();
  await page.getByTestId("settings-preset-hd").click();
  await expect(page.getByTestId("settings-width-input")).toHaveValue("1280");
  await expect(page.getByTestId("settings-height-input")).toHaveValue("720");
  await expect(page.getByTestId("settings-fps-input")).toHaveValue("30");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("screen-settings")).toBeVisible();
  await page.getByTestId("settings-save-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "設定を保存しました",
  );
  await expect(page.getByTestId("settings-script-model-select")).toHaveValue(
    "claude-sonnet-5",
  );
  await expect(page.getByTestId("settings-image-model-select")).toHaveValue(
    "gpt-image-2",
  );
  await expect(page.getByTestId("settings-dirty-status")).toContainText(
    "保存済み",
  );
  await visual.capture(page, "09-settings", "設定", [
    "APIキーを値の再表示なしで登録し、接続状態を確認できる",
    "未保存保護と用途別プリセットを使って安全に保存できる",
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
      models: {
        script: "gemini-3.5-flash",
        image: "gemini-3.1-flash-lite-image",
      },
      outputPreset: { width: 1920, height: 1080, fps: 30 },
    },
    apiKeyConfigured: {
      google: false,
      openai: false,
      anthropic: false,
    },
    keepLatestJobPending: false,
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
      const detail = createProjectDetail(state);
      // 初回表示では受付状態を確認し、次回ポーリングから完了へ進む実運用を模擬する。
      if (state.jobs[0]?.status === "PENDING" && !state.keepLatestJobPending) {
        state.jobs[0].status = "COMPLETED";
      }
      return fulfillJson(detail);
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
        `/api/projects/${projectId}/assets/asset-customer-journey-1` &&
      method === "DELETE"
    ) {
      state.assets = [];
      return fulfillJson({ ok: true });
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
      url.pathname === `/api/projects/${projectId}/timeline/import-final` &&
      method === "POST"
    ) {
      const current =
        state.timeline ??
        createTimelineFromScript(state.script ?? defaultScript());
      state.timeline = {
        ...current,
        editingMode: "final-video",
        playbackRange: { inMs: 0, outMs: 4500 },
        tracks: [
          {
            id: "track-final-video",
            name: "完成動画（再編集元）",
            type: "video",
            hidden: false,
            muted: false,
            clips: [
              {
                id: "final-video-main",
                assetType: "video",
                assetPath: "final/final.mp4",
                startMs: 0,
                durationMs: 4500,
                inMs: 0,
                outMs: 4500,
                volume: 1,
              },
            ],
          },
          {
            id: "track-overlay-subtitle",
            name: "追加テロップ",
            type: "subtitle",
            hidden: false,
            clips: [],
          },
          ...current.tracks.map((track) => ({
            ...track,
            ...(track.type === "audio" ? { muted: true } : { hidden: true }),
          })),
        ],
      };
      return fulfillJson({ timeline: state.timeline, durationMs: 4500 });
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
      const nextJobId =
        state.jobs.length === 0
          ? jobId
          : `00000000-0000-4000-8000-${String(101 + state.jobs.length).padStart(12, "0")}`;
      state.keepLatestJobPending = state.jobs.length >= 2;
      state.jobs = [
        {
          id: nextJobId,
          status: "PENDING",
          mode: String(body.mode ?? "full"),
          createdAt,
        },
        ...state.jobs,
      ];
      return fulfillJson({ projectId, jobId: nextJobId }, 201);
    }

    if (
      url.pathname.startsWith("/api/jobs/") &&
      url.pathname.includes("/files/") &&
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

    if (url.pathname === "/api/settings/secrets" && method === "GET") {
      return fulfillJson({
        googleApiKey: {
          configured: state.apiKeyConfigured.google,
          source: state.apiKeyConfigured.google ? "stored" : null,
        },
        openaiApiKey: {
          configured: state.apiKeyConfigured.openai,
          source: state.apiKeyConfigured.openai ? "stored" : null,
        },
        anthropicApiKey: {
          configured: state.apiKeyConfigured.anthropic,
          source: state.apiKeyConfigured.anthropic ? "stored" : null,
        },
      });
    }

    const secretProvider = url.pathname.match(
      /^\/api\/settings\/secrets\/(google|openai|anthropic)$/,
    )?.[1] as "google" | "openai" | "anthropic" | undefined;
    if (secretProvider && method === "PUT") {
      state.apiKeyConfigured[secretProvider] = Boolean(body.apiKey);
      return fulfillJson({
        ok: true,
        googleApiKey: {
          configured: state.apiKeyConfigured.google,
          source: state.apiKeyConfigured.google ? "stored" : null,
        },
        openaiApiKey: {
          configured: state.apiKeyConfigured.openai,
          source: state.apiKeyConfigured.openai ? "stored" : null,
        },
        anthropicApiKey: {
          configured: state.apiKeyConfigured.anthropic,
          source: state.apiKeyConfigured.anthropic ? "stored" : null,
        },
      });
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
        googleApiKey: {
          configured: state.apiKeyConfigured.google,
          reachable: state.apiKeyConfigured.google,
          source: state.apiKeyConfigured.google ? "stored" : null,
          status: state.apiKeyConfigured.google ? 200 : undefined,
        },
        openaiApiKey: {
          configured: state.apiKeyConfigured.openai,
          reachable: state.apiKeyConfigured.openai,
          source: state.apiKeyConfigured.openai ? "stored" : null,
          status: state.apiKeyConfigured.openai ? 200 : undefined,
        },
        anthropicApiKey: {
          configured: state.apiKeyConfigured.anthropic,
          reachable: state.apiKeyConfigured.anthropic,
          source: state.apiKeyConfigured.anthropic ? "stored" : null,
          status: state.apiKeyConfigured.anthropic ? 200 : undefined,
        },
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
    models: {
      script: string;
      image: string;
    };
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
    files:
      job.status === "COMPLETED"
        ? [
            {
              id: `preview-${job.id}`,
              relativePath: `projects/${projectId}/output/video_composition/latest/preview.mp4`,
              fileType: "video",
              fileCategory: "output",
            },
            {
              id: `final-${job.id}`,
              relativePath: `projects/${projectId}/final/final.mp4`,
              fileType: "video",
              fileCategory: "final",
            },
          ]
        : [],
  })),
  script: state.script,
  timeline: state.timeline,
  assets: state.assets,
  aiUsageSummary: {
    project: {
      requestCount: 2,
      inputTokens: 100_000,
      outputTokens: 20_000,
      imageCount: 3,
      estimatedCostUsd: 0.197,
      estimatedCostJpy: 31.52,
      unpricedRequestCount: 0,
      usdJpyRate: 160,
      pricingVersion: "2026-07-15",
      pricingSource: "https://ai.google.dev/gemini-api/docs/pricing",
      byModel: [
        {
          provider: "google",
          kind: "llm",
          model: "gemini-2.5-flash",
          requestCount: 1,
          inputTokens: 100_000,
          outputTokens: 20_000,
          imageCount: 0,
          estimatedCostUsd: 0.08,
          unpricedRequestCount: 0,
        },
        {
          provider: "google",
          kind: "image",
          model: "gemini-2.5-flash-image",
          requestCount: 1,
          inputTokens: 0,
          outputTokens: 0,
          imageCount: 3,
          estimatedCostUsd: 0.117,
          unpricedRequestCount: 0,
        },
      ],
    },
    latestJob: {
      requestCount: 1,
      inputTokens: 100_000,
      outputTokens: 20_000,
      imageCount: 0,
      estimatedCostUsd: 0.08,
      estimatedCostJpy: 12.8,
      unpricedRequestCount: 0,
      usdJpyRate: 160,
      pricingVersion: "2026-07-15",
      pricingSource: "https://ai.google.dev/gemini-api/docs/pricing",
      byModel: [],
    },
  },
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
