import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

test.afterAll(async () => {
  const prisma = new PrismaClient();
  try {
    // 実E2Eのデータだけを識別して消し、通常のローカルプロジェクトは保持する。
    await prisma.project.deleteMany({
      where: {
        theme: { startsWith: "実API E2E " },
        jobs: { none: { status: { in: ["PENDING", "RUNNING"] } } },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
});

test("実API/DB/Workerで制作開始からfinal.mp4生成まで通せる", async ({
  page,
  request,
}) => {
  await waitForApiHealth(request);

  await page.goto("/");
  await expect(page.getByTestId("screen-dashboard")).toBeVisible();

  await page.getByTestId("nav-wizard").click();
  await page.getByTestId("wizard-theme-input").fill(`実API E2E ${Date.now()}`);
  await page.getByTestId("wizard-mode-select").selectOption("custom");
  // この結合試験は制作経路を対象とし、画像課金や外部チャンネルへの投稿を行わない。
  for (const label of ["背景生成", "背景演出", "挿絵追加", "YouTube連携"]) {
    await page
      .getByTestId("wizard-custom-steps")
      .getByRole("checkbox", { name: `${label} 省略`, exact: true })
      .check();
  }
  await page.getByTestId("wizard-create-button").click();

  await expect(page.getByTestId("screen-project")).toBeVisible();
  await expect(page.getByTestId("selected-project-id")).toHaveAttribute(
    "data-project-id",
    /^[0-9a-f-]{36}$/,
  );
  const projectId = await page
    .getByTestId("selected-project-id")
    .getAttribute("data-project-id");
  if (!projectId) throw new Error("selected project id was not exposed");
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
  // 制作開始は既に最初のJobを投入する。初版完了後に編集して新版を生成する。
  await waitForJobCompletion(request, await waitForJobId(page));

  await page.getByTestId("nav-script").click();
  await page.getByTestId("script-title-input").fill("実APIから生成するE2E動画");
  await page.getByTestId("script-theme-input").fill("実API E2E");
  await page
    .getByTestId("script-line-text-0")
    .fill("実APIとDBとWorkerを通して検証します。");
  await page
    .getByTestId("script-line-text-1")
    .fill("最後にMP4の存在まで確認するぜ。");
  await page.getByTestId("script-save-button").click();
  await expect(page.getByTestId("app-message")).toContainText(
    "台本を保存しました",
  );

  await page.getByTestId("nav-preview").click();
  await page.getByTestId("preview-load-button").click();
  await expect(page.getByTestId("preview-summary")).toContainText(
    "durationInFrames",
  );
  for (const reviewId of ["picture", "subtitle", "audio", "rights"]) {
    await page.getByTestId(`delivery-review-${reviewId}`).check();
  }
  await page.getByTestId("preview-render-button").click();

  const jobId = await waitForJobId(page);

  const completedJob = await waitForJobCompletion(request, jobId!);
  const finalFile = completedJob.files.find(
    (file: { relativePath: string; fileType: string; fileCategory: string }) =>
      file.fileType === "video" &&
      file.fileCategory === "final" &&
      file.relativePath.endsWith("final.mp4"),
  );
  expect(finalFile).toBeTruthy();

  const outputRoot =
    process.env.YMM_WORKFLOW_OUTPUT_ROOT ??
    path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "real_api_e2e",
      "latest",
    );
  const finalPath = path.join(outputRoot, finalFile.relativePath);
  const finalStat = await fs.stat(finalPath);
  expect(finalStat.size).toBeGreaterThan(50_000);

  await page.getByTestId("nav-project").click();
  await page.screenshot({
    path: path.join(outputRoot, "project-detail-after-worker.png"),
    fullPage: true,
  });
});

const waitForJobCompletion = async (request: any, jobId: string) => {
  let latestJob: any = null;
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `http://127.0.0.1:3001/api/jobs/${jobId}`,
        );
        expect(response.ok()).toBe(true);
        latestJob = await response.json();
        if (latestJob.status === "FAILED") {
          throw new Error(latestJob.error ?? "job failed");
        }
        return latestJob.status;
      },
      {
        timeout: 210_000,
        intervals: [1000, 2000, 5000],
      },
    )
    .toBe("COMPLETED");
  return latestJob;
};

const waitForApiHealth = async (request: any) => {
  // Web起動直後は API がまだ listen 前のことがあるため、health 応答まで待つ
  await expect
    .poll(
      async () => {
        try {
          const response = await request.get("http://127.0.0.1:3001/health");
          return response.ok() ? response.status() : 0;
        } catch {
          return 0;
        }
      },
      {
        timeout: 30_000,
        intervals: [500, 1000, 2000],
      },
    )
    .toBe(200);
};

const waitForJobId = async (page: any) => {
  // 人間向けメッセージへUUIDを露出せず、テスト用属性からjobIdを読む
  let jobId = "";
  await expect
    .poll(
      async () => {
        jobId =
          (await page.getByTestId("app-message").getAttribute("data-job-id")) ??
          "";
        return jobId;
      },
      {
        timeout: 15_000,
        intervals: [250, 500, 1000],
      },
    )
    .not.toBe("");
  return jobId;
};
