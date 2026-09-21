import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

test("実APIで投入時入力を固定し保存後の編集を守って実動画を出力する", async ({
  request,
  page,
}) => {
  const base = "http://127.0.0.1:3001";
  await expect
    .poll(
      async () => {
        try {
          return (await request.get(`${base}/health`)).status();
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  const settings = {
    models: { script: "gpt-5.6-luna", image: "gpt-image-2" },
    outputPreset: { width: 640, height: 360, fps: 24 },
  };
  const originalSettings = await (
    await request.get(`${base}/api/settings`)
  ).json();
  const prisma = new PrismaClient();
  let projectId: string | undefined;
  let release = () => {};
  let lock: Promise<unknown> | undefined;
  try {
    expect(
      (await request.put(`${base}/api/settings`, { data: settings })).ok(),
    ).toBe(true);
    const created = await request.post(`${base}/api/projects`, {
      data: { theme: `実API E2E 入力固定 ${Date.now()}`, mode: "renderOnly" },
    });
    expect(created.status()).toBe(201);
    projectId = (await created.json()).projectId;
    expect(
      await (
        await request.get(`${base}/api/projects/${projectId}/settings`)
      ).json(),
    ).toEqual(settings);
    const scriptA = {
      title: "投入時の台本",
      lines: [
        { speaker: "reimu", text: "ジョブ投入時の台本で動画を作ります。" },
        { speaker: "marisa", text: "編集後の台本は次の生成に使うぜ。" },
      ],
    };
    expect(
      (
        await request.put(`${base}/api/projects/${projectId}/script`, {
          data: scriptA,
        })
      ).ok(),
    ).toBe(true);
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const finish = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Workerを実DBロックで待機させ、投入後・実行前の変更を確実に再現する。
    lock = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${projectId!}, 0))::text`;
        locked();
        await finish;
      },
      { timeout: 60000 },
    );
    await ready;
    const queued = await request.post(
      `${base}/api/projects/${projectId}/jobs`,
      {
        data: {
          mode: "renderOnly",
          skipSteps: [
            "background_generation",
            "background_animation",
            "illustration_insertion",
          ],
        },
      },
    );
    expect(queued.status()).toBe(201);
    const { jobId } = await queued.json();
    const scriptB = {
      ...scriptA,
      title: "投入後に保存した台本",
      lines: [{ speaker: "reimu", text: "これは次回の動画用です。" }],
    };
    expect(
      (
        await request.put(`${base}/api/projects/${projectId}/script`, {
          data: scriptB,
        })
      ).ok(),
    ).toBe(true);
    release();
    await lock;
    lock = undefined;
    let job: any;
    await expect
      .poll(
        async () => {
          job = await (await request.get(`${base}/api/jobs/${jobId}`)).json();
          if (job.status === "FAILED") throw new Error(job.error);
          return job.status;
        },
        { timeout: 210000, intervals: [500, 1000, 2000] },
      )
      .toBe("COMPLETED");
    expect(job.inputRevision).toMatch(/^snapshot-v1:/);
    expect(job.settingsJson).toEqual(settings);
    expect(
      await (
        await request.get(`${base}/api/projects/${projectId}/script`)
      ).json(),
    ).toEqual(scriptB);
    const outputRoot = process.env.YMM_WORKFLOW_OUTPUT_ROOT!;
    const work = path.join(
      outputRoot,
      "projects",
      projectId!,
      "jobs",
      jobId,
      "work",
    );
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(work, "output/script_generation/latest/script.json"),
          "utf8",
        ),
      ),
    ).toEqual(scriptA);
    const timestamps = await fs.readFile(
      path.join(work, "output/tts_generation/latest/timestamps.json"),
      "utf8",
    );
    expect(timestamps).toContain(scriptA.lines[0].text);
    expect(timestamps).not.toContain(scriptB.lines[0].text);
    const finalFile = job.files.find(
      (file: any) =>
        file.fileCategory === "final" &&
        file.relativePath.endsWith("final.mp4"),
    );
    expect(finalFile).toBeTruthy();
    const finalPath = path.join(outputRoot, finalFile.relativePath);
    const command = promisify(execFile);
    const probe = await command("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size:stream=codec_name,codec_type,width,height",
      "-of",
      "json",
      finalPath,
    ]);
    await command("ffmpeg", [
      "-v",
      "error",
      "-i",
      finalPath,
      "-f",
      "null",
      "-",
    ]);
    await fs.writeFile(
      path.join(outputRoot, "snapshot-video-evidence.json"),
      JSON.stringify(
        {
          jobId,
          finalPath,
          ttsProvider: process.env.YMM_TTS_PROVIDER,
          disableRemotion: process.env.YMM_DISABLE_REMOTION,
          fullDecode: true,
          media: JSON.parse(probe.stdout),
        },
        null,
        2,
      ),
    );
    await page.goto("/");
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });
    await page
      .getByRole("button", { name: `${project.theme}を開く`, exact: true })
      .click();
    await page.getByTestId("nav-preview").click();
    await expect(page.locator("video").first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("video")
          .first()
          .evaluate((video: HTMLVideoElement) => video.readyState),
      )
      .toBeGreaterThanOrEqual(2);
    expect(
      await page
        .locator("video")
        .first()
        .evaluate((video: HTMLVideoElement) => video.error?.message ?? null),
    ).toBeNull();
    await page.screenshot({
      path: path.join(outputRoot, "snapshot-video-browser.png"),
      fullPage: true,
    });
  } finally {
    release();
    await lock;
    await request.put(`${base}/api/settings`, { data: originalSettings });
    if (projectId) await prisma.project.delete({ where: { id: projectId } });
    await prisma.$disconnect();
  }
});
