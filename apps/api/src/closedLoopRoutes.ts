import { promises as fs } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  collectDueYoutubeMetrics,
  captureJobInputs,
  withProjectInputLock,
  fetchGoogleTrendCandidates,
  proposeNextTheme,
  reconcileAutomationRuns,
  runClosedLoopCycle,
  type YoutubeAuthConfig,
} from "@ymm/core";
import type { FastifyInstance } from "fastify";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { readSettings } from "./storage";

export const automationConfigBodySchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.number().int().min(1).max(8760),
  nextRunAt: z.string().datetime().nullable(),
  defaultPrivacyStatus: z.enum(["private", "unlisted", "public"]),
  publishDelayMinutes: z.number().int().min(0).max(10080),
  dailyUploadLimit: z.number().int().min(0).max(20),
  maxConcurrentRuns: z.number().int().min(1).max(4),
  mockWhenApiUnavailable: z.boolean(),
  channelId: z.string().trim().min(1).max(64).nullable(),
  topicSeed: z.string().trim().min(1).max(200),
});

type RouteOptions = {
  prisma: PrismaClient;
  boss: PgBoss;
  workspaceRoot: string;
  authConfig?: YoutubeAuthConfig;
  now?: () => Date;
  loadTrendCandidates?: () => Promise<string[]>;
};

export async function registerClosedLoopRoutes(
  app: FastifyInstance,
  options: RouteOptions,
): Promise<void> {
  const now = options.now ?? (() => new Date());
  const authConfig = options.authConfig ?? readYoutubeAuthConfig();
  const loadTrendCandidates =
    options.loadTrendCandidates ?? (() => fetchGoogleTrendCandidates());

  app.get("/api/automation/config", async () => {
    const config = await options.prisma.automationConfig.findUnique({
      where: { id: "default" },
    });
    return config ?? defaultAutomationConfig();
  });

  app.put("/api/automation/config", async (request) => {
    const body = automationConfigBodySchema.parse(request.body ?? {});
    const data = {
      ...body,
      nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : null,
    };
    const config = await options.prisma.automationConfig.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });
    request.log.info(
      {
        enabled: config.enabled,
        intervalHours: config.intervalHours,
        nextRunAt: config.nextRunAt,
        dailyUploadLimit: config.dailyUploadLimit,
      },
      "closed_loop_automation_config_updated",
    );
    return toJsonSafe(config);
  });

  app.get("/api/automation/status", async () => {
    await reconcileAutomationRuns(options.prisma, now());
    const [config, activeRuns, recentRuns, recentPublications, lastDecision] =
      await Promise.all([
        options.prisma.automationConfig.findUnique({
          where: { id: "default" },
        }),
        options.prisma.automationRun.count({
          where: { status: { in: ["RUNNING", "QUEUED"] } },
        }),
        options.prisma.automationRun.findMany({
          orderBy: { startedAt: "desc" },
          take: 10,
        }),
        options.prisma.youtubePublication.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            metricSnapshots: { orderBy: { windowHours: "asc" } },
            evaluations: { orderBy: { windowHours: "asc" } },
          },
          take: 10,
        }),
        options.prisma.themeDecision.findFirst({
          orderBy: { createdAt: "desc" },
        }),
      ]);
    return toJsonSafe({
      config: config ?? defaultAutomationConfig(),
      activeRuns,
      recentRuns,
      recentPublications,
      lastDecision,
      credentials: credentialAvailability(authConfig),
    });
  });

  app.post("/api/automation/collect", async (request) => {
    const config = await options.prisma.automationConfig.findUnique({
      where: { id: "default" },
    });
    const result = await collectDueYoutubeMetrics({
      prisma: options.prisma,
      now: now(),
      authConfig,
      mockWhenApiUnavailable: config?.mockWhenApiUnavailable ?? true,
      channelId: config?.channelId,
    });
    await writeAutomationEvidence(options.workspaceRoot, "collect", {
      at: now().toISOString(),
      result,
    });
    request.log.info(
      toJsonSafe(result),
      "youtube_metrics_collection_completed",
    );
    return toJsonSafe(result);
  });

  app.post("/api/automation/themes", async (request) => {
    const config = await options.prisma.automationConfig.findUnique({
      where: { id: "default" },
    });
    const trends = await loadTrendCandidates();
    const candidates =
      trends.length > 0
        ? trends
        : [
            config?.topicSeed ?? "ゆっくり解説",
            `${config?.topicSeed ?? "ゆっくり解説"} 最新動向`,
            `${config?.topicSeed ?? "ゆっくり解説"} 初心者向け`,
          ];
    const decision = await proposeNextTheme({
      prisma: options.prisma,
      candidates,
      now: now(),
      source: trends.length > 0 ? "google_trends" : "topic_seed",
    });
    await writeAutomationEvidence(options.workspaceRoot, "theme", {
      at: now().toISOString(),
      decision,
    });
    request.log.info(
      { decisionId: decision.id, selectedTheme: decision.selectedTheme },
      "closed_loop_theme_proposed",
    );
    return toJsonSafe(decision);
  });

  app.post("/api/automation/run", async (request, reply) => {
    const result = await runClosedLoopCycle({
      prisma: options.prisma,
      trigger: "manual",
      now: now(),
      authConfig,
      loadTrendCandidates,
      prepareRenderJob: async (jobId) => {
        const job = await options.prisma.job.findUniqueOrThrow({
          where: { id: jobId },
          include: { project: true },
        });
        await withProjectInputLock(options.prisma, job.projectId, async () => {
          const settings = await readSettings(options.workspaceRoot);
          const inputRevision = await captureJobInputs({
            workspaceRoot: options.workspaceRoot,
            outputRoot:
              process.env.YMM_WORKFLOW_OUTPUT_ROOT ?? options.workspaceRoot,
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
    await writeAutomationEvidence(options.workspaceRoot, "run", {
      at: now().toISOString(),
      result,
    });
    request.log.info(toJsonSafe(result), "closed_loop_manual_run_finished");
    return reply.code(result.started ? 201 : 409).send(toJsonSafe(result));
  });
}

export const readYoutubeAuthConfig = (): YoutubeAuthConfig => ({
  clientId: process.env.YOUTUBE_CLIENT_ID,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
  accessToken: process.env.YOUTUBE_ACCESS_TOKEN,
});

const defaultAutomationConfig = () => ({
  id: "default",
  enabled: false,
  intervalHours: 168,
  nextRunAt: null,
  defaultPrivacyStatus: "private",
  publishDelayMinutes: 0,
  dailyUploadLimit: 1,
  maxConcurrentRuns: 1,
  mockWhenApiUnavailable: true,
  channelId: null,
  topicSeed: "ゆっくり解説",
});

const credentialAvailability = (auth: YoutubeAuthConfig) => ({
  refreshTokenConfigured: Boolean(
    auth.clientId?.trim() &&
    auth.clientSecret?.trim() &&
    auth.refreshToken?.trim(),
  ),
  accessTokenConfigured: Boolean(auth.accessToken?.trim()),
});

const writeAutomationEvidence = async (
  workspaceRoot: string,
  kind: string,
  payload: unknown,
): Promise<void> => {
  const directory = path.join(
    workspaceRoot,
    "outputs",
    "test_evidence",
    "task28_closed_loop",
  );
  await fs.mkdir(directory, { recursive: true });
  const json = JSON.stringify(toJsonSafe(payload), null, 2);
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  await Promise.all([
    fs.writeFile(
      path.join(directory, `${kind}-${timestamp}.json`),
      json,
      "utf-8",
    ),
    fs.writeFile(path.join(directory, `latest-${kind}.json`), json, "utf-8"),
  ]);
};

const toJsonSafe = (value: unknown): any => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !["accessToken", "refreshToken", "clientSecret"].includes(key),
        )
        .map(([key, nested]) => [key, toJsonSafe(nested)]),
    );
  }
  return value;
};
