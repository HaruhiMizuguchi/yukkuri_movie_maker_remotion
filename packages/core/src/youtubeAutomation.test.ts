import { describe, expect, it, vi } from "vitest";
import {
  buildYoutubeVideoStatus,
  chooseDueMetricWindows,
  createMockAnalyticsSnapshot,
  decideAutomationRun,
  evaluateVideoPerformance,
  parseYoutubeAnalyticsReport,
  parseYoutubeVideoResource,
  rankThemeCandidates,
  resolveYoutubeAccessToken,
} from "./youtubeAutomation";

describe("resolveYoutubeAccessToken", () => {
  it("更新トークンを短期アクセストークンへ交換する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "refreshed-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await resolveYoutubeAccessToken(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "refresh-token",
        accessToken: "legacy-token",
      },
      fetchFn,
    );

    expect(result).toEqual({
      available: true,
      accessToken: "refreshed-token",
      source: "refresh_token",
      expiresInSeconds: 3600,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetchFn.mock.calls[0]?.[1] as RequestInit;
    expect(String(request.body)).toContain("grant_type=refresh_token");
  });

  it("更新情報がない場合は従来の直接アクセストークンを使う", async () => {
    await expect(
      resolveYoutubeAccessToken({ accessToken: "legacy-token" }),
    ).resolves.toEqual({
      available: true,
      accessToken: "legacy-token",
      source: "access_token",
    });
  });

  it("認証情報がなければ後続が判断できる理由を返す", async () => {
    await expect(resolveYoutubeAccessToken({})).resolves.toEqual({
      available: false,
      reason: "youtube_credentials_missing",
    });
  });
});

describe("buildYoutubeVideoStatus", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");

  it("予約公開はYouTube仕様に合わせてprivateとpublishAtを組み合わせる", () => {
    expect(
      buildYoutubeVideoStatus(
        {
          privacyStatus: "public",
          publishAt: "2026-07-18T09:00:00.000Z",
        },
        now,
      ),
    ).toEqual({
      privacyStatus: "private",
      publishAt: "2026-07-18T09:00:00.000Z",
    });
  });

  it("過去日時の予約公開を拒否する", () => {
    expect(() =>
      buildYoutubeVideoStatus(
        { privacyStatus: "public", publishAt: "2026-07-16T00:00:00.000Z" },
        now,
      ),
    ).toThrow("youtube_publish_at_must_be_future");
  });
});

describe("YouTube分析レスポンス", () => {
  it("ヘッダー順に依存せず指標を読み取る", () => {
    const parsed = parseYoutubeAnalyticsReport({
      columnHeaders: [
        { name: "likes" },
        { name: "views" },
        { name: "averageViewPercentage" },
        { name: "estimatedMinutesWatched" },
        { name: "averageViewDuration" },
        { name: "comments" },
        { name: "shares" },
        { name: "subscribersGained" },
        { name: "subscribersLost" },
      ],
      rows: [[12, 450, 62.5, 800, 106.3, 4, 3, 8, 2]],
    });

    expect(parsed).toEqual({
      status: "completed",
      metrics: {
        views: 450,
        likes: 12,
        comments: 4,
        shares: 3,
        estimatedMinutesWatched: 800,
        averageViewDurationSeconds: 106.3,
        averageViewPercentage: 62.5,
        subscribersGained: 8,
        subscribersLost: 2,
      },
    });
  });

  it("未確定データを数値0と混同しない", () => {
    expect(
      parseYoutubeAnalyticsReport({ columnHeaders: [], rows: [] }),
    ).toEqual({ status: "no_data", metrics: null });
  });
});

describe("YouTube Data API投稿状態", () => {
  it("投稿処理状態と公開状態、公開統計を読み取る", () => {
    expect(
      parseYoutubeVideoResource({
        items: [
          {
            status: { privacyStatus: "public", uploadStatus: "processed" },
            processingDetails: { processingStatus: "succeeded" },
            statistics: {
              viewCount: "1200",
              likeCount: "55",
              commentCount: "8",
            },
          },
        ],
      }),
    ).toEqual({
      status: "completed",
      video: {
        privacyStatus: "public",
        uploadStatus: "processed",
        processingStatus: "succeeded",
        views: 1200,
        likes: 55,
        comments: 8,
      },
    });
  });
});

describe("評価窓", () => {
  it("投稿後の経過時間から未収集の24/72/168時間窓だけを返す", () => {
    expect(
      chooseDueMetricWindows({
        publishedAt: new Date("2026-07-10T00:00:00.000Z"),
        now: new Date("2026-07-17T12:00:00.000Z"),
        collectedWindows: [24, 72],
      }),
    ).toEqual([168]);
  });
});

describe("動画評価", () => {
  it("同じ公開後時間帯の基準値と比較して説明付きスコアを返す", () => {
    const evaluation = evaluateVideoPerformance({
      metrics: {
        views: 2000,
        likes: 120,
        comments: 20,
        shares: 10,
        estimatedMinutesWatched: 7000,
        averageViewDurationSeconds: 210,
        averageViewPercentage: 70,
        subscribersGained: 25,
        subscribersLost: 2,
      },
      baseline: {
        views: 1000,
        averageViewPercentage: 50,
        engagementRate: 0.05,
        subscriberConversionRate: 0.005,
      },
    });

    expect(evaluation.score).toBeGreaterThan(70);
    expect(evaluation.components.views).toBe(100);
    expect(evaluation.reasons.join(" ")).toContain("基準");
  });
});

describe("テーマ順位付け", () => {
  it("トレンド・過去成績・新規性を合成し、選定理由を残す", () => {
    const ranked = rankThemeCandidates({
      candidates: [
        { theme: "生成AIの安全な使い方", trendScore: 82 },
        { theme: "宇宙開発ニュース", trendScore: 70 },
      ],
      historicalPerformanceByTheme: {
        生成AIの安全な使い方: 88,
        宇宙開発ニュース: 55,
      },
      recentlyPublishedThemes: ["宇宙開発ニュース"],
    });

    expect(ranked[0]?.theme).toBe("生成AIの安全な使い方");
    expect(ranked[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("トレンド"),
        expect.stringContaining("過去成績"),
      ]),
    );
    expect(ranked[1]?.noveltyScore).toBe(0);
  });
});

describe("API制約時のモック", () => {
  it("動画IDと窓から再現可能なモック指標を生成する", () => {
    const first = createMockAnalyticsSnapshot("mock-video-1", 24);
    const second = createMockAnalyticsSnapshot("mock-video-1", 24);
    expect(first).toEqual(second);
    expect(first.status).toBe("mocked");
    expect(first.metrics.views).toBeGreaterThan(0);
  });

  it("累積指標が長い評価窓で減少しない", () => {
    for (let index = 0; index < 100; index += 1) {
      const videoId = `mock-video-${index}`;
      const day1 = createMockAnalyticsSnapshot(videoId, 24);
      const day3 = createMockAnalyticsSnapshot(videoId, 72);
      const day7 = createMockAnalyticsSnapshot(videoId, 168);
      expect(day3.metrics.views).toBeGreaterThanOrEqual(day1.metrics.views);
      expect(day7.metrics.views).toBeGreaterThanOrEqual(day3.metrics.views);
      expect(day3.metrics.estimatedMinutesWatched).toBeGreaterThanOrEqual(
        day1.metrics.estimatedMinutesWatched,
      );
    }
  });
});

describe("自動運用安全ゲート", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");

  it("停止中・日次上限・同時実行を区別する", () => {
    expect(
      decideAutomationRun({
        enabled: false,
        now,
        nextRunAt: null,
        uploadsToday: 0,
        dailyUploadLimit: 1,
        activeRuns: 0,
        maxConcurrentRuns: 1,
      }),
    ).toEqual({ allowed: false, reason: "automation_disabled" });

    expect(
      decideAutomationRun({
        enabled: true,
        now,
        nextRunAt: null,
        uploadsToday: 1,
        dailyUploadLimit: 1,
        activeRuns: 0,
        maxConcurrentRuns: 1,
      }),
    ).toEqual({ allowed: false, reason: "daily_upload_limit_reached" });

    expect(
      decideAutomationRun({
        enabled: true,
        now,
        nextRunAt: null,
        uploadsToday: 0,
        dailyUploadLimit: 1,
        activeRuns: 1,
        maxConcurrentRuns: 1,
      }),
    ).toEqual({ allowed: false, reason: "automation_run_already_active" });
  });

  it("条件を満たす場合だけ実行を許可する", () => {
    expect(
      decideAutomationRun({
        enabled: true,
        now,
        nextRunAt: new Date("2026-07-16T23:00:00.000Z"),
        uploadsToday: 0,
        dailyUploadLimit: 1,
        activeRuns: 0,
        maxConcurrentRuns: 1,
      }),
    ).toEqual({ allowed: true });
  });
});
