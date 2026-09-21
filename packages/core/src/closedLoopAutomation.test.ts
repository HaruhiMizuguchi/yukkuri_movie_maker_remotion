import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  collectDueYoutubeMetrics,
  proposeNextTheme,
  runClosedLoopCycle,
} from "./closedLoopAutomation";

const publication = {
  id: "publication-1",
  projectId: "project-1",
  jobId: "job-1",
  youtubeVideoId: "mock-video-1",
  theme: "生成AI",
  publishedAt: new Date("2026-07-01T00:00:00.000Z"),
  uploadedAt: new Date("2026-07-01T00:00:00.000Z"),
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  isMock: true,
};

describe("collectDueYoutubeMetrics", () => {
  it.each(["COMPLETED", "FAILED"])(
    "%sの確定済み・再試行待ち窓を連続照会しない",
    async (status) => {
      const prisma = {
        youtubePublication: {
          findMany: async () => [
            {
              ...publication,
              isMock: false,
              publishedAt: new Date("2026-07-15"),
            },
          ],
        },
        youtubeMetricSnapshot: {
          findMany: async () => [
            {
              windowHours: 24,
              status,
              capturedAt: new Date("2026-07-17T00:00:00Z"),
            },
          ],
          upsert: vi.fn(),
        },
      } as any;
      const result = await collectDueYoutubeMetrics({
        prisma,
        now: new Date("2026-07-17T00:01:00Z"),
        authConfig: {},
        mockWhenApiUnavailable: false,
      });
      expect(result.snapshotsSaved).toBe(0);
      expect(prisma.youtubeMetricSnapshot.upsert).not.toHaveBeenCalled();
    },
  );
  it.each(["FAILED", "NO_DATA", "MOCKED"])(
    "%sの実投稿指標を再収集して評価を更新する",
    async (status) => {
      const upsert = vi.fn().mockResolvedValue({});
      const evaluate = vi.fn().mockResolvedValue({});
      const prisma = {
        youtubePublication: {
          findMany: async () => [
            {
              ...publication,
              isMock: false,
              publishedAt: new Date("2026-07-15"),
            },
          ],
          update: async () => ({}),
        },
        youtubeMetricSnapshot: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              { windowHours: 24, status, capturedAt: new Date("2026-07-16") },
            ])
            .mockResolvedValue([]),
          upsert,
        },
        videoEvaluation: {
          upsert: evaluate,
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      } as any;
      const result = await collectDueYoutubeMetrics({
        prisma,
        now: new Date("2026-07-17"),
        authConfig: { accessToken: "test" },
        mockWhenApiUnavailable: false,
        fetchFn: async () =>
          new Response(
            JSON.stringify({
              columnHeaders: [{ name: "views" }],
              rows: [[50]],
            }),
          ),
      });
      expect(result.snapshotsSaved).toBe(1);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: "COMPLETED", views: 50n }),
        }),
      );
      expect(evaluate).toHaveBeenCalledTimes(1);
    },
  );
  it("認証がない場合は理由付きモックで全評価窓を保存・評価する", async () => {
    const metricUpsert = vi.fn().mockResolvedValue({});
    const evaluationUpsert = vi.fn().mockResolvedValue({});
    const prisma = {
      youtubePublication: {
        findMany: vi.fn().mockResolvedValue([publication]),
      },
      youtubeMetricSnapshot: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValue([]),
        upsert: metricUpsert,
      },
      videoEvaluation: { upsert: evaluationUpsert },
    } as unknown as PrismaClient;

    const result = await collectDueYoutubeMetrics({
      prisma,
      now: new Date("2026-07-17T00:00:00.000Z"),
      authConfig: {},
      mockWhenApiUnavailable: true,
    });

    expect(result).toMatchObject({
      publicationsScanned: 1,
      snapshotsSaved: 3,
      mockedSnapshots: 3,
      evaluationsSaved: 3,
      auth: { available: false, reason: "youtube_credentials_missing" },
    });
    expect(metricUpsert).toHaveBeenCalledTimes(3);
    expect(metricUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "MOCKED",
          source: "mock",
          failureReason: "youtube_credentials_missing",
        }),
      }),
    );
    expect(evaluationUpsert).toHaveBeenCalledTimes(3);
  });

  it("実APIのno_dataを0件視聴として評価しない", async () => {
    const metricUpsert = vi.fn().mockResolvedValue({});
    const evaluationUpsert = vi.fn().mockResolvedValue({});
    const prisma = {
      youtubePublication: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...publication,
            isMock: false,
            publishedAt: new Date("2026-07-15"),
          },
        ]),
      },
      youtubeMetricSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: metricUpsert,
      },
      videoEvaluation: { upsert: evaluationUpsert },
    } as unknown as PrismaClient;
    const fetchFn = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ columnHeaders: [], rows: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const result = await collectDueYoutubeMetrics({
      prisma,
      now: new Date("2026-07-17T00:00:00.000Z"),
      authConfig: { accessToken: "token" },
      mockWhenApiUnavailable: false,
      fetchFn,
    });

    expect(result.snapshotsSaved).toBe(1);
    expect(metricUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "NO_DATA",
          views: null,
        }),
      }),
    );
    expect(evaluationUpsert).not.toHaveBeenCalled();
  });
});

describe("proposeNextTheme", () => {
  it("評価履歴と直近テーマを参照して判断履歴を保存する", async () => {
    const createDecision = vi.fn().mockImplementation(({ data }) => ({
      id: "decision-1",
      ...data,
    }));
    const prisma = {
      videoEvaluation: {
        findMany: vi.fn().mockResolvedValue([
          {
            score: 90,
            publication: { theme: "生成AIの安全な使い方" },
          },
        ]),
      },
      youtubePublication: {
        findMany: vi.fn().mockResolvedValue([{ theme: "宇宙開発ニュース" }]),
      },
      themeDecision: { create: createDecision },
    } as unknown as PrismaClient;

    const decision = await proposeNextTheme({
      prisma,
      candidates: ["宇宙開発ニュース", "生成AIの安全な使い方"],
      now: new Date("2026-07-17T00:00:00.000Z"),
      source: "google_trends",
    });

    expect(decision.selectedTheme).toBe("生成AIの安全な使い方");
    expect(createDecision).toHaveBeenCalledWith({
      data: expect.objectContaining({
        selectedTheme: "生成AIの安全な使い方",
        source: "google_trends",
      }),
    });
  });
});

describe("runClosedLoopCycle", () => {
  it("安全ゲートを通過したら収集・テーマ判断・Job投入・次回更新を行う", async () => {
    const enqueueRenderJob = vi.fn().mockResolvedValue("queue-1");
    const runUpdate = vi.fn().mockResolvedValue({});
    const configUpdate = vi.fn().mockResolvedValue({});
    const decisionUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      automationConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          enabled: true,
          intervalHours: 168,
          nextRunAt: new Date("2026-07-16T00:00:00.000Z"),
          defaultPrivacyStatus: "private",
          publishDelayMinutes: 0,
          dailyUploadLimit: 1,
          maxConcurrentRuns: 1,
          mockWhenApiUnavailable: true,
          channelId: null,
          topicSeed: "技術解説",
        }),
        update: configUpdate,
      },
      automationRun: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "run-1" }),
        update: runUpdate,
      },
      youtubePublication: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      youtubeMetricSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
      videoEvaluation: { findMany: vi.fn().mockResolvedValue([]) },
      themeDecision: {
        create: vi.fn().mockImplementation(({ data }) => ({
          id: "decision-1",
          ...data,
        })),
        update: decisionUpdate,
      },
      project: {
        create: vi.fn().mockResolvedValue({ id: "project-1" }),
      },
      job: { create: vi.fn().mockResolvedValue({ id: "job-1" }) },
    } as unknown as PrismaClient;

    // トランザクション内の予約と通常処理で同じ台帳を参照する。
    (prisma as any).$queryRaw = vi.fn().mockResolvedValue([]);
    (prisma as any).$transaction = vi.fn((callback) => callback(prisma));
    const result = await runClosedLoopCycle({
      prisma,
      trigger: "manual",
      now: new Date("2026-07-17T00:00:00.000Z"),
      authConfig: {},
      loadTrendCandidates: vi.fn().mockResolvedValue(["生成AI", "宇宙開発"]),
      enqueueRenderJob,
    });

    expect(result).toMatchObject({
      started: true,
      runId: "run-1",
      projectId: "project-1",
      jobId: "job-1",
    });
    expect(enqueueRenderJob).toHaveBeenCalledWith("job-1");
    expect(decisionUpdate).toHaveBeenCalledWith({
      where: { id: "decision-1" },
      data: { projectId: "project-1" },
    });
    expect(configUpdate).toHaveBeenCalledWith({
      where: { id: "default" },
      data: { nextRunAt: new Date("2026-07-24T00:00:00.000Z") },
    });
    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "QUEUED" }),
      }),
    );
  });
});
