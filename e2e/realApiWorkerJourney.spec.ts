import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

test("実API/DB/Workerで制作開始からfinal.mp4生成まで通せる", async ({ page, request }) => {
  const health = await request.get("http://127.0.0.1:3001/health");
  expect(health.ok()).toBe(true);

  await page.goto("/");
  await expect(page.getByTestId("screen-dashboard")).toBeVisible();

  await page.getByTestId("nav-wizard").click();
  await page.getByTestId("wizard-theme-input").fill(`実API E2E ${Date.now()}`);
  await page.getByTestId("wizard-mode-select").selectOption("full");
  await page.getByTestId("wizard-create-button").click();

  await expect(page.getByTestId("screen-project")).toBeVisible();
  const projectId = (await page.getByTestId("selected-project-id").innerText()).trim();
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/);

  await page.getByTestId("nav-script").click();
  await page.getByTestId("script-title-input").fill("実APIから生成するE2E動画");
  await page.getByTestId("script-theme-input").fill("実API E2E");
  await page.getByTestId("script-line-text-0").fill("実APIとDBとWorkerを通して検証します。");
  await page.getByTestId("script-line-text-1").fill("最後にMP4の存在まで確認するぜ。");
  await page.getByTestId("script-save-button").click();
  await expect(page.getByRole("status")).toContainText("台本を保存しました");

  await page.getByTestId("nav-preview").click();
  await page.getByTestId("preview-load-button").click();
  await expect(page.getByTestId("preview-summary")).toContainText("durationInFrames");
  await page.getByTestId("preview-render-button").click();

  const message = await page.getByRole("status").innerText();
  const jobId = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
  expect(jobId).toBeTruthy();

  const completedJob = await waitForJobCompletion(request, jobId!);
  const finalFile = completedJob.files.find(
    (file: { relativePath: string; fileType: string; fileCategory: string }) =>
      file.fileType === "video" &&
      file.fileCategory === "final" &&
      file.relativePath.endsWith("final.mp4")
  );
  expect(finalFile).toBeTruthy();

  const outputRoot =
    process.env.YMM_WORKFLOW_OUTPUT_ROOT ??
    path.join(process.cwd(), "outputs", "test_evidence", "real_api_e2e", "latest");
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
        const response = await request.get(`http://127.0.0.1:3001/api/jobs/${jobId}`);
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
      }
    )
    .toBe("COMPLETED");
  return latestJob;
};
