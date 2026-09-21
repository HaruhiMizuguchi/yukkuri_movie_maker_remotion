import type { PrismaClient } from "@prisma/client";
import {
  fetchGoogleTrendCandidates,
  captureJobInputs,
  withProjectInputLock,
  reconcileAutomationRuns,
  runClosedLoopCycle,
} from "@ymm/core";
import type PgBoss from "pg-boss";
import { readWorkerSettings } from "./settings";
import {
  resolveWorkerOutputRoot,
  resolveWorkerWorkspaceRoot,
} from "./workspaceRoot";

export function startAutomationScheduler(options: {
  intervalMs: number;
  runTick: () => Promise<unknown>;
}): { stop: () => void; runNow: () => Promise<void> } {
  let running = false;
  let stopped = false;
  const execute = async (): Promise<void> => {
    if (running || stopped) return;
    running = true;
    try {
      await options.runTick();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "closed_loop_scheduler_error",
          at: new Date().toISOString(),
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      running = false;
    }
  };
  // Worker再起動後に次回時刻を過ぎた処理を取りこぼさないよう即時確認する。
  void execute();
  const timer = setInterval(
    () => void execute(),
    Math.max(1_000, options.intervalMs),
  );
  timer.unref?.();
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    runNow: execute,
  };
}

export async function runAutomationSchedulerTick(options: {
  prisma: PrismaClient;
  boss: PgBoss;
  now?: Date;
  fetchFn?: typeof fetch;
  workspaceRoot?: string;
  outputRoot?: string;
}): Promise<unknown> {
  const now = options.now ?? new Date();
  const workspaceRoot =
    options.workspaceRoot ?? resolveWorkerWorkspaceRoot(import.meta.url);
  const outputRoot =
    options.outputRoot ??
    resolveWorkerOutputRoot(
      import.meta.url,
      process.env.YMM_WORKFLOW_OUTPUT_ROOT,
    );
  const reconciliation = await reconcileAutomationRuns(options.prisma, now);
  const result = await runClosedLoopCycle({
    prisma: options.prisma,
    trigger: "scheduled",
    now,
    authConfig: {
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
      accessToken: process.env.YOUTUBE_ACCESS_TOKEN,
    },
    fetchFn: options.fetchFn,
    loadTrendCandidates: () => fetchGoogleTrendCandidates(options.fetchFn),
    prepareRenderJob: async (jobId) => {
      const job = await options.prisma.job.findUniqueOrThrow({
        where: { id: jobId },
        include: { project: true },
      });
      await withProjectInputLock(options.prisma, job.projectId, async () => {
        const settings = await readWorkerSettings(workspaceRoot);
        const inputRevision = await captureJobInputs({
          workspaceRoot,
          outputRoot,
          projectId: job.projectId,
          jobId,
          settings,
          theme: job.project.theme,
        });
        await options.prisma.job.update({
          where: { id: jobId },
          data: { inputRevision, settingsJson: settings },
        });
        await options.prisma.project.update({
          where: { id: job.projectId },
          data: { settingsJson: settings },
        });
      });
    },
    enqueueRenderJob: async (jobId) =>
      (await options.boss.send("yukkuri.render", {
        jobId,
        runMode: "resume",
      })) ?? null,
  });
  console.log(
    JSON.stringify({
      event: "closed_loop_scheduler_tick",
      at: now.toISOString(),
      reconciliation,
      result: toJsonSafe(result),
    }),
  );
  return result;
}

const toJsonSafe = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJsonSafe(nested)]),
    );
  }
  return value;
};
