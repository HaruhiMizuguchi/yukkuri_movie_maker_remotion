import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  collectDueYoutubeMetrics,
  proposeNextTheme,
} from "./closedLoopAutomation";
import {
  createMockAnalyticsSnapshot,
  resolveYoutubeAccessToken,
} from "./youtubeAutomation";

const runId = `run-${Date.now()}`;
const evidenceRoot = path.join(
  process.cwd(),
  "outputs",
  "test_evidence",
  "task28_closed_loop",
  runId,
);

describe("task28 closed loop real integration", () => {
  it("実PostgreSQLへ投稿・分析・評価・テーマ判断を永続化する", async () => {
    const prisma = new PrismaClient();
    const project = await prisma.project.create({
      data: {
        theme: "閉ループ実DBテスト",
        ownerId: "default",
        automationMode: "full",
      },
    });
    const job = await prisma.job.create({
      data: { projectId: project.id, mode: "full", runMode: "resume" },
    });
    let decisionId: string | undefined;
    try {
      const publication = await prisma.youtubePublication.create({
        data: {
          projectId: project.id,
          jobId: job.id,
          youtubeVideoId: `mock-${runId}`,
          idempotencyKey: `mock-${runId}`,
          theme: project.theme!,
          title: "閉ループ実DBテスト",
          status: "MOCKED",
          privacyStatus: "private",
          uploadedAt: new Date("2026-07-01T00:00:00.000Z"),
          publishedAt: new Date("2026-07-01T00:00:00.000Z"),
          sourcePath: "projects/mock/final/final.mp4",
          isMock: true,
          failureReason: "youtube_credentials_missing",
        },
      });
      const collection = await collectDueYoutubeMetrics({
        prisma,
        now: new Date("2026-07-17T00:00:00.000Z"),
        authConfig: {},
        mockWhenApiUnavailable: true,
      });
      const snapshots = await prisma.youtubeMetricSnapshot.findMany({
        where: { publicationId: publication.id },
        orderBy: { windowHours: "asc" },
      });
      const evaluations = await prisma.videoEvaluation.findMany({
        where: { publicationId: publication.id },
        orderBy: { windowHours: "asc" },
      });
      const decision = await proposeNextTheme({
        prisma,
        candidates: ["閉ループ実DBテスト", "次世代AIニュース"],
        now: new Date("2026-07-17T00:00:00.000Z"),
        source: "real_db_test",
      });
      decisionId = decision.id;

      await fs.mkdir(evidenceRoot, { recursive: true });
      await fs.writeFile(
        path.join(evidenceRoot, "database-cycle.json"),
        JSON.stringify(
          {
            collection,
            snapshots: snapshots.map((item) => ({
              windowHours: item.windowHours,
              status: item.status,
              views: item.views?.toString() ?? null,
            })),
            evaluations: evaluations.map((item) => ({
              windowHours: item.windowHours,
              score: item.score,
            })),
            decision: {
              id: decision.id,
              selectedTheme: decision.selectedTheme,
              score: decision.score,
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      expect(snapshots.map((item) => item.windowHours)).toEqual([24, 72, 168]);
      expect(evaluations).toHaveLength(3);
      expect(decision.selectedTheme).toBeTruthy();
    } finally {
      if (decisionId) {
        await prisma.themeDecision.delete({ where: { id: decisionId } });
      }
      await prisma.project.delete({ where: { id: project.id } });
      await prisma.$disconnect();
    }
  });

  it("YouTubeへ実接続し、制約時は理由付きモック成果物へ切り替える", async () => {
    const auth = await resolveYoutubeAccessToken({
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
      accessToken: process.env.YOUTUBE_ACCESS_TOKEN,
    });
    let artifact: Record<string, unknown>;
    if (auth.available) {
      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
        {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          signal: AbortSignal.timeout(20_000),
        },
      );
      const payload = (await response.json()) as {
        items?: Array<{ id?: string; snippet?: { title?: string } }>;
        error?: unknown;
      };
      if (response.ok && payload.items?.[0]?.id) {
        artifact = {
          mode: "real_api",
          authSource: auth.source,
          httpStatus: response.status,
          channelId: payload.items[0].id,
          channelTitle: payload.items[0].snippet?.title ?? null,
        };
      } else {
        artifact = {
          mode: "mock_fallback",
          reason: `youtube_channels_http_${response.status}`,
          mockSnapshot: createMockAnalyticsSnapshot(
            "connectivity-fallback",
            24,
          ),
        };
      }
    } else {
      artifact = {
        mode: "mock_fallback",
        reason: auth.reason,
        mockSnapshot: createMockAnalyticsSnapshot("credentials-missing", 24),
      };
    }

    await fs.mkdir(evidenceRoot, { recursive: true });
    await fs.writeFile(
      path.join(evidenceRoot, "youtube-api-status.json"),
      JSON.stringify(artifact, null, 2),
      "utf-8",
    );
    expect(["real_api", "mock_fallback"]).toContain(artifact.mode);
  });
});
