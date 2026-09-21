import { Prisma, type PrismaClient } from "@prisma/client";
import {
  chooseDueMetricWindows,
  createMockAnalyticsSnapshot,
  decideAutomationRun,
  evaluateVideoPerformance,
  fetchYoutubeAnalytics,
  fetchYoutubeVideoResource,
  rankThemeCandidates,
  resolveYoutubeAccessToken,
  type VideoPerformanceBaseline,
  type YoutubeAnalyticsMetrics,
  type YoutubeAuthConfig,
} from "./youtubeAutomation";

export type ClosedLoopCollectionSummary = {
  publicationsScanned: number;
  snapshotsSaved: number;
  mockedSnapshots: number;
  evaluationsSaved: number;
  dataApiRefreshes: number;
  dataApiFailures: Array<{ publicationId: string; reason: string }>;
  failures: Array<{
    publicationId: string;
    windowHours: number;
    reason: string;
  }>;
  auth:
    | {
        available: true;
        source: "refresh_token" | "access_token";
        expiresInSeconds?: number;
      }
    | { available: false; reason: string };
};

export async function collectDueYoutubeMetrics(input: {
  prisma: PrismaClient;
  now?: Date;
  authConfig: YoutubeAuthConfig;
  mockWhenApiUnavailable: boolean;
  channelId?: string | null;
  fetchFn?: typeof fetch;
}): Promise<ClosedLoopCollectionSummary> {
  const now = input.now ?? new Date();
  const auth = await resolveYoutubeAccessToken(input.authConfig, input.fetchFn);
  const publications = await input.prisma.youtubePublication.findMany({
    where: {
      youtubeVideoId: { not: null },
      status: { in: ["UPLOADED", "PUBLISHED", "MOCKED"] },
      OR: [{ publishedAt: { not: null } }, { isMock: true }],
    },
    orderBy: { createdAt: "asc" },
  });
  const summary: ClosedLoopCollectionSummary = {
    publicationsScanned: publications.length,
    snapshotsSaved: 0,
    mockedSnapshots: 0,
    evaluationsSaved: 0,
    dataApiRefreshes: 0,
    dataApiFailures: [],
    failures: [],
    // 認証情報はAPI呼び出し内に閉じ、診断・永続化には公開属性だけを渡す。
    auth: auth.available
      ? {
          available: true,
          source: auth.source,
          ...(auth.expiresInSeconds !== undefined
            ? { expiresInSeconds: auth.expiresInSeconds }
            : {}),
        }
      : { available: false, reason: auth.reason },
  };

  for (const publication of publications) {
    const publishedAt =
      publication.publishedAt ??
      publication.uploadedAt ??
      publication.createdAt;
    if (auth.available && !publication.isMock) {
      const resource = await fetchYoutubeVideoResource({
        accessToken: auth.accessToken,
        videoId: publication.youtubeVideoId!,
        fetchFn: input.fetchFn,
      });
      if (resource.status === "completed") {
        const remotelyPublished =
          resource.video.privacyStatus === "public" ||
          resource.video.privacyStatus === "unlisted";
        await input.prisma.youtubePublication.update({
          where: { id: publication.id },
          data: {
            privacyStatus: resource.video.privacyStatus,
            status:
              resource.video.uploadStatus === "failed"
                ? "FAILED"
                : remotelyPublished
                  ? "PUBLISHED"
                  : publication.status,
            metadataJson: {
              dataApi: resource.video,
              refreshedAt: now.toISOString(),
            },
          },
        });
        summary.dataApiRefreshes += 1;
      } else if (resource.status === "failed") {
        summary.dataApiFailures.push({
          publicationId: publication.id,
          reason: resource.reason,
        });
      }
    }
    if (
      publication.status === "UPLOADED" &&
      publication.publishedAt &&
      publication.publishedAt <= now
    ) {
      await input.prisma.youtubePublication.update({
        where: { id: publication.id },
        data: { status: "PUBLISHED" },
      });
    }
    const existing = await input.prisma.youtubeMetricSnapshot.findMany({
      where: { publicationId: publication.id },
      select: { windowHours: true, status: true, capturedAt: true },
    });
    const dueWindows = chooseDueMetricWindows({
      publishedAt,
      now,
      collectedWindows: existing
        .filter(
          (item) =>
            item.status === "COMPLETED" ||
            (item.status === "MOCKED" && publication.isMock) ||
            // 一時障害の連続照会を抑えつつ、未確定・代替モックは後で再取得する。
            (item.capturedAt &&
              now.getTime() - item.capturedAt.getTime() < 15 * 60 * 1000),
        )
        .map((item) => item.windowHours),
    });

    for (const windowHours of dueWindows) {
      const periodEnd = new Date(
        Math.min(
          now.getTime(),
          publishedAt.getTime() + windowHours * 60 * 60 * 1000,
        ),
      );
      const authReason = auth.available ? null : auth.reason;
      const shouldMock =
        publication.isMock || (!auth.available && input.mockWhenApiUnavailable);
      let result:
        | {
            status: "completed" | "mocked";
            metrics: YoutubeAnalyticsMetrics;
            reason?: string;
          }
        | { status: "no_data" | "failed"; metrics: null; reason?: string };

      if (shouldMock) {
        const mocked = createMockAnalyticsSnapshot(
          publication.youtubeVideoId!,
          windowHours,
        );
        result = {
          status: "mocked",
          metrics: mocked.metrics,
          reason: authReason ?? mocked.reason,
        };
      } else if (auth.available) {
        result = await fetchYoutubeAnalytics({
          accessToken: auth.accessToken,
          videoId: publication.youtubeVideoId!,
          startDate: toYoutubeDate(publishedAt),
          endDate: toYoutubeDate(periodEnd),
          channelId: input.channelId,
          fetchFn: input.fetchFn,
        });
      } else {
        result = {
          status: "failed",
          metrics: null,
          reason: auth.reason,
        };
      }

      const metricData = toMetricSnapshotData({
        publicationId: publication.id,
        windowHours,
        periodStart: publishedAt,
        periodEnd,
        capturedAt: now,
        result,
      });
      await input.prisma.youtubeMetricSnapshot.upsert({
        where: {
          publicationId_windowHours: {
            publicationId: publication.id,
            windowHours,
          },
        },
        create: metricData,
        update: {
          ...metricData,
          capturedAt: now,
        },
      });
      summary.snapshotsSaved += 1;
      if (result.status === "mocked") summary.mockedSnapshots += 1;
      if (result.status === "failed") {
        summary.failures.push({
          publicationId: publication.id,
          windowHours,
          reason: result.reason ?? "youtube_analytics_failed",
        });
      }

      if (
        !result.metrics &&
        existing.some(
          (item) =>
            item.windowHours === windowHours && item.status === "MOCKED",
        )
      ) {
        // 実指標への置換が未確定の間、以前の架空評価を実績として残さない。
        await input.prisma.videoEvaluation.deleteMany({
          where: { publicationId: publication.id, windowHours },
        });
      }

      if (result.metrics) {
        const baseline = await loadPerformanceBaseline(
          input.prisma,
          publication.id,
          windowHours,
        );
        const evaluation = evaluateVideoPerformance({
          metrics: result.metrics,
          baseline,
        });
        await input.prisma.videoEvaluation.upsert({
          where: {
            publicationId_windowHours: {
              publicationId: publication.id,
              windowHours,
            },
          },
          create: {
            publicationId: publication.id,
            windowHours,
            score: evaluation.score,
            componentsJson: evaluation.components,
            reasonsJson: evaluation.reasons,
            evaluatedAt: now,
          },
          update: {
            score: evaluation.score,
            componentsJson: evaluation.components,
            reasonsJson: evaluation.reasons,
            evaluatedAt: now,
          },
        });
        summary.evaluationsSaved += 1;
      }
    }
  }
  return summary;
}

export async function proposeNextTheme(input: {
  prisma: PrismaClient;
  candidates: string[];
  now?: Date;
  source: string;
}) {
  const now = input.now ?? new Date();
  const evaluations = await input.prisma.videoEvaluation.findMany({
    include: { publication: { select: { theme: true } } },
    orderBy: { evaluatedAt: "desc" },
    take: 200,
  });
  const themeScores = new Map<string, number[]>();
  for (const evaluation of evaluations) {
    const scores = themeScores.get(evaluation.publication.theme) ?? [];
    scores.push(evaluation.score);
    themeScores.set(evaluation.publication.theme, scores);
  }
  const historicalPerformanceByTheme = Object.fromEntries(
    [...themeScores].map(([theme, scores]) => [
      theme,
      scores.reduce((sum, score) => sum + score, 0) / scores.length,
    ]),
  );
  const recentPublications = await input.prisma.youtubePublication.findMany({
    orderBy: { createdAt: "desc" },
    select: { theme: true },
    take: 12,
  });
  const uniqueCandidates = [
    ...new Set(input.candidates.map((theme) => theme.trim()).filter(Boolean)),
  ];
  if (uniqueCandidates.length === 0) {
    throw new Error("theme_candidates_empty");
  }
  const ranked = rankThemeCandidates({
    candidates: uniqueCandidates.map((theme, index) => ({
      theme,
      trendScore: Math.max(40, 100 - index * 5),
    })),
    historicalPerformanceByTheme,
    recentlyPublishedThemes: recentPublications.map((item) => item.theme),
  });
  const selected = ranked[0]!;
  return input.prisma.themeDecision.create({
    data: {
      selectedTheme: selected.theme,
      score: selected.score,
      candidatesJson: ranked,
      reasonsJson: selected.reasons,
      source: input.source,
      sourceMetricsUntil: now,
    },
  });
}

export async function reserveAutomationRun(input: {
  prisma: PrismaClient;
  trigger: "scheduled" | "manual";
  now: Date;
}) {
  // APIとWorkerが共有するトランザクションロックで、検査と予約を不可分にする。
  return input.prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(72917029)::text`;
      const config = await tx.automationConfig.findUnique({
        where: { id: "default" },
      });
      if (!config)
        return { started: false as const, reason: "automation_not_configured" };
      const dayStart = new Date(input.now);
      dayStart.setUTCHours(0, 0, 0, 0);
      const publishedStatuses = ["UPLOADED", "PUBLISHED", "MOCKED"];
      const activeWhere = { status: { in: ["RUNNING", "QUEUED"] } };
      const [uploadsToday, activeRuns, pendingUploads] = await Promise.all([
        tx.youtubePublication.count({
          where: {
            uploadedAt: { gte: dayStart },
            status: { in: publishedStatuses },
          },
        }),
        tx.automationRun.count({ where: activeWhere }),
        tx.automationRun.count({
          where: {
            ...activeWhere,
            OR: [
              { jobId: null },
              {
                job: {
                  is: {
                    youtubePublications: {
                      none: { status: { in: publishedStatuses } },
                    },
                  },
                },
              },
            ],
          },
        }),
      ]);
      const gate = decideAutomationRun({
        enabled: config.enabled,
        now: input.now,
        nextRunAt: input.trigger === "manual" ? null : config.nextRunAt,
        uploadsToday: uploadsToday + pendingUploads,
        dailyUploadLimit: config.dailyUploadLimit,
        activeRuns,
        maxConcurrentRuns: config.maxConcurrentRuns,
      });
      if (!gate.allowed)
        return { started: false as const, reason: gate.reason };
      const run = await tx.automationRun.create({
        data: {
          trigger: input.trigger,
          status: "RUNNING",
          startedAt: input.now,
        },
      });
      await tx.automationConfig.update({
        where: { id: config.id },
        data: {
          nextRunAt: new Date(
            input.now.getTime() + Math.max(1, config.intervalHours) * 3600000,
          ),
        },
      });
      return { started: true as const, config, run };
    },
    { maxWait: 15000, timeout: 15000 },
  );
}

export async function runClosedLoopCycle(input: {
  prisma: PrismaClient;
  trigger: "scheduled" | "manual";
  now?: Date;
  authConfig: YoutubeAuthConfig;
  fetchFn?: typeof fetch;
  loadTrendCandidates: () => Promise<string[]>;
  enqueueRenderJob: (jobId: string) => Promise<string | null>;
  prepareRenderJob?: (jobId: string) => Promise<void>;
}): Promise<
  | {
      started: true;
      runId: string;
      projectId: string;
      jobId: string;
      theme: string;
      collection: ClosedLoopCollectionSummary;
    }
  | { started: false; reason: string; runId?: string }
> {
  const now = input.now ?? new Date();
  const reservation = await reserveAutomationRun({ ...input, now });
  if (!reservation.started) return reservation;
  const { config, run } = reservation;
  let projectId: string | undefined;
  let jobId: string | undefined;
  try {
    const collection = await collectDueYoutubeMetrics({
      prisma: input.prisma,
      now,
      authConfig: input.authConfig,
      mockWhenApiUnavailable: config.mockWhenApiUnavailable,
      channelId: config.channelId,
      fetchFn: input.fetchFn,
    });
    const loadedCandidates = await input.loadTrendCandidates();
    const candidates =
      loadedCandidates.length > 0
        ? loadedCandidates
        : [
            config.topicSeed,
            `${config.topicSeed} 最新動向`,
            `${config.topicSeed} 初心者向け`,
          ];
    const decision = await proposeNextTheme({
      prisma: input.prisma,
      candidates,
      now,
      source: loadedCandidates.length > 0 ? "google_trends" : "topic_seed",
    });
    const project = await input.prisma.project.create({
      data: {
        theme: decision.selectedTheme,
        ownerId: "default",
        automationMode: "full",
      },
    });
    projectId = project.id;
    const job = await input.prisma.job.create({
      data: {
        projectId: project.id,
        mode: "full",
        runMode: "resume",
      },
    });
    jobId = job.id;
    await input.prisma.automationRun.update({
      where: { id: run.id },
      data: { projectId: project.id, jobId: job.id },
    });
    await input.prisma.themeDecision.update({
      where: { id: decision.id },
      data: { projectId: project.id },
    });
    await input.prepareRenderJob?.(job.id);
    const queueJobId = await input.enqueueRenderJob(job.id);
    if (!queueJobId) throw new Error("automation_queue_rejected");

    await input.prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: "QUEUED",
        projectId: project.id,
        jobId: job.id,
        detailsJson: {
          decisionId: decision.id,
          selectedTheme: decision.selectedTheme,
          queueJobId,
          collection: toJsonSafeValue(collection),
        } as Prisma.InputJsonValue,
      },
    });
    return {
      started: true,
      runId: run.id,
      projectId: project.id,
      jobId: job.id,
      theme: decision.selectedTheme,
      collection,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (jobId) {
      await input.prisma.job.update({
        where: { id: jobId },
        data: { status: "FAILED", error: reason, completedAt: now },
      });
    }
    if (projectId) {
      await input.prisma.project.update({
        where: { id: projectId },
        data: { status: "FAILED" },
      });
    }
    await input.prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "FAILED", reason, completedAt: now },
    });
    return { started: false, reason, runId: run.id };
  }
}

export async function reconcileAutomationRuns(
  prisma: PrismaClient,
  now = new Date(),
): Promise<{ completed: number; failed: number; cancelled: number }> {
  const runs = await prisma.automationRun.findMany({
    where: { status: "QUEUED", jobId: { not: null } },
    include: { job: { select: { status: true, error: true } } },
  });
  const result = { completed: 0, failed: 0, cancelled: 0 };
  for (const run of runs) {
    const status = run.job?.status;
    if (!status || status === "PENDING" || status === "RUNNING") continue;
    const runStatus =
      status === "COMPLETED"
        ? "COMPLETED"
        : status === "CANCELLED"
          ? "CANCELLED"
          : "FAILED";
    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: runStatus,
        reason: runStatus === "FAILED" ? run.job?.error : null,
        completedAt: now,
      },
    });
    if (runStatus === "COMPLETED") result.completed += 1;
    else if (runStatus === "CANCELLED") result.cancelled += 1;
    else result.failed += 1;
  }
  return result;
}

const loadPerformanceBaseline = async (
  prisma: PrismaClient,
  publicationId: string,
  windowHours: number,
): Promise<VideoPerformanceBaseline> => {
  const snapshots = await prisma.youtubeMetricSnapshot.findMany({
    where: {
      publicationId: { not: publicationId },
      windowHours,
      status: { in: ["COMPLETED", "MOCKED"] },
      views: { not: null },
    },
    orderBy: { capturedAt: "desc" },
    take: 50,
  });
  if (snapshots.length === 0) {
    return {
      views: Math.round(500 * (windowHours / 24)),
      averageViewPercentage: 50,
      engagementRate: 0.05,
      subscriberConversionRate: 0.005,
    };
  }
  const metrics = snapshots.map((snapshot) => ({
    views: Number(snapshot.views ?? 0),
    averageViewPercentage: snapshot.averageViewPercentage ?? 0,
    engagementRate:
      Number(snapshot.views ?? 0) > 0
        ? Number(
            (snapshot.likes ?? 0n) +
              (snapshot.comments ?? 0n) +
              (snapshot.shares ?? 0n),
          ) / Number(snapshot.views)
        : 0,
    subscriberConversionRate:
      Number(snapshot.views ?? 0) > 0
        ? Math.max(
            0,
            Number(snapshot.subscribersGained ?? 0n) -
              Number(snapshot.subscribersLost ?? 0n),
          ) / Number(snapshot.views)
        : 0,
  }));
  return {
    views: average(metrics.map((item) => item.views)),
    averageViewPercentage: average(
      metrics.map((item) => item.averageViewPercentage),
    ),
    engagementRate: average(metrics.map((item) => item.engagementRate)),
    subscriberConversionRate: average(
      metrics.map((item) => item.subscriberConversionRate),
    ),
  };
};

const toMetricSnapshotData = (input: {
  publicationId: string;
  windowHours: number;
  periodStart: Date;
  periodEnd: Date;
  capturedAt: Date;
  result:
    | {
        status: "completed" | "mocked";
        metrics: YoutubeAnalyticsMetrics;
        reason?: string;
      }
    | { status: "no_data" | "failed"; metrics: null; reason?: string };
}) => {
  const status = input.result.status.toUpperCase();
  const metrics = input.result.metrics;
  return {
    publicationId: input.publicationId,
    windowHours: input.windowHours,
    status,
    source: input.result.status === "mocked" ? "mock" : "youtube_api",
    capturedAt: input.capturedAt,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    views: metrics ? BigInt(Math.round(metrics.views)) : null,
    likes: metrics ? BigInt(Math.round(metrics.likes)) : null,
    comments: metrics ? BigInt(Math.round(metrics.comments)) : null,
    shares: metrics ? BigInt(Math.round(metrics.shares)) : null,
    estimatedMinutesWatched: metrics?.estimatedMinutesWatched ?? null,
    averageViewDurationSeconds: metrics?.averageViewDurationSeconds ?? null,
    averageViewPercentage: metrics?.averageViewPercentage ?? null,
    subscribersGained: metrics
      ? BigInt(Math.round(metrics.subscribersGained))
      : null,
    subscribersLost: metrics
      ? BigInt(Math.round(metrics.subscribersLost))
      : null,
    failureReason: input.result.reason ?? null,
    rawJson: metrics
      ? (metrics as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
};

const toYoutubeDate = (date: Date): string => date.toISOString().slice(0, 10);

const average = (values: number[]): number =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const toJsonSafeValue = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        toJsonSafeValue(nested),
      ]),
    );
  }
  return value;
};
