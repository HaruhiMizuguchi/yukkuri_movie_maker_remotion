export type YoutubePrivacyStatus = "private" | "unlisted" | "public";

export type YoutubeAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
};

export type YoutubeAccessTokenResult =
  | {
      available: true;
      accessToken: string;
      source: "refresh_token" | "access_token";
      expiresInSeconds?: number;
    }
  | { available: false; reason: string };

export type YoutubeAnalyticsMetrics = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  estimatedMinutesWatched: number;
  averageViewDurationSeconds: number;
  averageViewPercentage: number;
  subscribersGained: number;
  subscribersLost: number;
};

export type YoutubeAnalyticsSnapshot =
  | { status: "completed"; metrics: YoutubeAnalyticsMetrics }
  | { status: "no_data"; metrics: null };

export type YoutubeVideoResource = {
  privacyStatus: string;
  uploadStatus: string;
  processingStatus: string;
  views: number;
  likes: number;
  comments: number;
};

type AnalyticsReport = {
  columnHeaders?: Array<{ name?: unknown }>;
  rows?: unknown[][];
};

const ANALYTICS_METRIC_NAMES = [
  "views",
  "likes",
  "comments",
  "shares",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "subscribersGained",
  "subscribersLost",
] as const;

export const YOUTUBE_ANALYTICS_METRICS = ANALYTICS_METRIC_NAMES.join(",");
export const YOUTUBE_METRIC_WINDOWS_HOURS = [24, 72, 168] as const;

export async function resolveYoutubeAccessToken(
  config: YoutubeAuthConfig,
  fetchFn: typeof fetch = fetch,
): Promise<YoutubeAccessTokenResult> {
  const clientId = config.clientId?.trim();
  const clientSecret = config.clientSecret?.trim();
  const refreshToken = config.refreshToken?.trim();

  // 長期運用では短期アクセストークンより更新トークンを優先する。
  if (clientId && clientSecret && refreshToken) {
    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });
      const response = await fetchFn("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json()) as {
        access_token?: unknown;
        expires_in?: unknown;
      };
      if (!response.ok || typeof payload.access_token !== "string") {
        return {
          available: false,
          reason: `youtube_token_refresh_http_${response.status}`,
        };
      }
      return {
        available: true,
        accessToken: payload.access_token,
        source: "refresh_token",
        ...(typeof payload.expires_in === "number"
          ? { expiresInSeconds: payload.expires_in }
          : {}),
      };
    } catch (error) {
      return {
        available: false,
        reason: `youtube_token_refresh_failed:${toErrorMessage(error)}`,
      };
    }
  }

  const accessToken = config.accessToken?.trim();
  if (accessToken) {
    return { available: true, accessToken, source: "access_token" };
  }
  return { available: false, reason: "youtube_credentials_missing" };
}

export function buildYoutubeVideoStatus(
  input: { privacyStatus: YoutubePrivacyStatus; publishAt?: string | null },
  now = new Date(),
): { privacyStatus: YoutubePrivacyStatus; publishAt?: string } {
  if (!input.publishAt) {
    return { privacyStatus: input.privacyStatus };
  }
  const publishAt = new Date(input.publishAt);
  if (!Number.isFinite(publishAt.getTime()) || publishAt <= now) {
    throw new Error("youtube_publish_at_must_be_future");
  }
  // YouTubeの予約公開はprivate動画にpublishAtを指定する必要がある。
  return { privacyStatus: "private", publishAt: publishAt.toISOString() };
}

export function parseYoutubeAnalyticsReport(
  report: AnalyticsReport,
): YoutubeAnalyticsSnapshot {
  const row = report.rows?.[0];
  if (!row) {
    return { status: "no_data", metrics: null };
  }
  const values = new Map<string, number>();
  (report.columnHeaders ?? []).forEach((header, index) => {
    if (typeof header.name !== "string") return;
    values.set(header.name, toFiniteNumber(row[index]));
  });
  return {
    status: "completed",
    metrics: {
      views: values.get("views") ?? 0,
      likes: values.get("likes") ?? 0,
      comments: values.get("comments") ?? 0,
      shares: values.get("shares") ?? 0,
      estimatedMinutesWatched: values.get("estimatedMinutesWatched") ?? 0,
      averageViewDurationSeconds: values.get("averageViewDuration") ?? 0,
      averageViewPercentage: values.get("averageViewPercentage") ?? 0,
      subscribersGained: values.get("subscribersGained") ?? 0,
      subscribersLost: values.get("subscribersLost") ?? 0,
    },
  };
}

export const buildYoutubeAnalyticsUrl = (input: {
  videoId: string;
  startDate: string;
  endDate: string;
  channelId?: string | null;
}): string => {
  const query = new URLSearchParams({
    ids: input.channelId ? `channel==${input.channelId}` : "channel==MINE",
    startDate: input.startDate,
    endDate: input.endDate,
    metrics: YOUTUBE_ANALYTICS_METRICS,
    filters: `video==${input.videoId}`,
  });
  return `https://youtubeanalytics.googleapis.com/v2/reports?${query.toString()}`;
};

export async function fetchYoutubeAnalytics(input: {
  accessToken: string;
  videoId: string;
  startDate: string;
  endDate: string;
  channelId?: string | null;
  fetchFn?: typeof fetch;
}): Promise<
  YoutubeAnalyticsSnapshot | { status: "failed"; metrics: null; reason: string }
> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const response = await fetchFn(buildYoutubeAnalyticsUrl(input), {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        status: "failed",
        metrics: null,
        reason: `youtube_analytics_http_${response.status}`,
      };
    }
    return parseYoutubeAnalyticsReport(
      (await response.json()) as AnalyticsReport,
    );
  } catch (error) {
    return {
      status: "failed",
      metrics: null,
      reason: `youtube_analytics_failed:${toErrorMessage(error)}`,
    };
  }
}

export function parseYoutubeVideoResource(payload: {
  items?: Array<{
    status?: { privacyStatus?: unknown; uploadStatus?: unknown };
    processingDetails?: { processingStatus?: unknown };
    statistics?: {
      viewCount?: unknown;
      likeCount?: unknown;
      commentCount?: unknown;
    };
  }>;
}):
  | { status: "completed"; video: YoutubeVideoResource }
  | { status: "no_data"; video: null } {
  const item = payload.items?.[0];
  if (!item) return { status: "no_data", video: null };
  return {
    status: "completed",
    video: {
      privacyStatus: toStringOrUnknown(item.status?.privacyStatus),
      uploadStatus: toStringOrUnknown(item.status?.uploadStatus),
      processingStatus: toStringOrUnknown(
        item.processingDetails?.processingStatus,
      ),
      views: toFiniteNumber(item.statistics?.viewCount),
      likes: toFiniteNumber(item.statistics?.likeCount),
      comments: toFiniteNumber(item.statistics?.commentCount),
    },
  };
}

export async function fetchYoutubeVideoResource(input: {
  accessToken: string;
  videoId: string;
  fetchFn?: typeof fetch;
}): Promise<
  | { status: "completed"; video: YoutubeVideoResource }
  | { status: "no_data"; video: null }
  | { status: "failed"; video: null; reason: string }
> {
  const fetchFn = input.fetchFn ?? fetch;
  const query = new URLSearchParams({
    part: "status,processingDetails,statistics",
    id: input.videoId,
  });
  try {
    const response = await fetchFn(
      `https://www.googleapis.com/youtube/v3/videos?${query.toString()}`,
      {
        headers: { Authorization: `Bearer ${input.accessToken}` },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      return {
        status: "failed",
        video: null,
        reason: `youtube_video_status_http_${response.status}`,
      };
    }
    return parseYoutubeVideoResource(
      (await response.json()) as Parameters<
        typeof parseYoutubeVideoResource
      >[0],
    );
  } catch (error) {
    return {
      status: "failed",
      video: null,
      reason: `youtube_video_status_failed:${toErrorMessage(error)}`,
    };
  }
}

export async function fetchGoogleTrendCandidates(
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  try {
    const response = await fetchFn(
      "https://trends.google.com/trending/rss?geo=JP",
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return [];
    const text = await response.text();
    return Array.from(text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g))
      .map((match) => match[1]?.trim() ?? "")
      .filter((title) => title && !title.includes("Daily Search Trends"))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function chooseDueMetricWindows(input: {
  publishedAt: Date;
  now: Date;
  collectedWindows: number[];
}): number[] {
  const elapsedHours =
    (input.now.getTime() - input.publishedAt.getTime()) / (60 * 60 * 1000);
  const collected = new Set(input.collectedWindows);
  return YOUTUBE_METRIC_WINDOWS_HOURS.filter(
    (windowHours) => elapsedHours >= windowHours && !collected.has(windowHours),
  );
}

export type VideoPerformanceBaseline = {
  views: number;
  averageViewPercentage: number;
  engagementRate: number;
  subscriberConversionRate: number;
};

export function evaluateVideoPerformance(input: {
  metrics: YoutubeAnalyticsMetrics;
  baseline: VideoPerformanceBaseline;
}): {
  score: number;
  components: {
    views: number;
    retention: number;
    engagement: number;
    subscriberConversion: number;
  };
  reasons: string[];
} {
  const views = Math.max(0, input.metrics.views);
  const engagementRate =
    views > 0
      ? (input.metrics.likes + input.metrics.comments + input.metrics.shares) /
        views
      : 0;
  const subscriberConversionRate =
    views > 0
      ? Math.max(
          0,
          input.metrics.subscribersGained - input.metrics.subscribersLost,
        ) / views
      : 0;
  const components = {
    views: ratioToScore(views, input.baseline.views),
    retention: ratioToScore(
      input.metrics.averageViewPercentage,
      input.baseline.averageViewPercentage,
    ),
    engagement: ratioToScore(engagementRate, input.baseline.engagementRate),
    subscriberConversion: ratioToScore(
      subscriberConversionRate,
      input.baseline.subscriberConversionRate,
    ),
  };
  const score = round1(
    components.views * 0.4 +
      components.retention * 0.3 +
      components.engagement * 0.2 +
      components.subscriberConversion * 0.1,
  );
  return {
    score,
    components,
    reasons: [
      `再生数は同じ評価窓の基準に対して${formatRatio(views, input.baseline.views)}です。`,
      `平均視聴率は基準に対して${formatRatio(input.metrics.averageViewPercentage, input.baseline.averageViewPercentage)}です。`,
      `反応率は基準に対して${formatRatio(engagementRate, input.baseline.engagementRate)}です。`,
      `登録転換率は基準に対して${formatRatio(subscriberConversionRate, input.baseline.subscriberConversionRate)}です。`,
    ],
  };
}

export function rankThemeCandidates(input: {
  candidates: Array<{ theme: string; trendScore: number }>;
  historicalPerformanceByTheme: Record<string, number>;
  recentlyPublishedThemes: string[];
}): Array<{
  theme: string;
  score: number;
  trendScore: number;
  historicalScore: number;
  noveltyScore: number;
  reasons: string[];
}> {
  const recent = new Set(
    input.recentlyPublishedThemes.map((theme) => normalizeTheme(theme)),
  );
  return input.candidates
    .map((candidate) => {
      const trendScore = clamp(candidate.trendScore, 0, 100);
      const historicalScore = clamp(
        input.historicalPerformanceByTheme[candidate.theme] ?? 50,
        0,
        100,
      );
      const noveltyScore = recent.has(normalizeTheme(candidate.theme))
        ? 0
        : 100;
      return {
        theme: candidate.theme,
        score: round1(
          trendScore * 0.45 + historicalScore * 0.4 + noveltyScore * 0.15,
        ),
        trendScore,
        historicalScore,
        noveltyScore,
        reasons: [
          `トレンド評価 ${trendScore.toFixed(1)}点`,
          `類似テーマの過去成績 ${historicalScore.toFixed(1)}点`,
          noveltyScore === 0
            ? "直近公開テーマと重複するため新規性を減点"
            : "直近公開テーマと重複せず新規性を加点",
        ],
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function createMockAnalyticsSnapshot(
  videoId: string,
  windowHours: number,
): {
  status: "mocked";
  reason: "youtube_api_unavailable_mock_used";
  metrics: YoutubeAnalyticsMetrics;
} {
  // 同じ動画と評価窓では常に同じ値となり、回帰テストを安定させる。
  const seed = stableHash(videoId);
  const scale = Math.max(1, windowHours / 24);
  const growth = 1 + Math.log2(scale) * 0.75;
  const views = Math.round((120 + (seed % 900)) * growth);
  return {
    status: "mocked",
    reason: "youtube_api_unavailable_mock_used",
    metrics: {
      views,
      likes: Math.round(views * (0.03 + (seed % 30) / 1000)),
      comments: Math.round(views * (0.004 + (seed % 8) / 1000)),
      shares: Math.round(views * (0.002 + (seed % 6) / 1000)),
      estimatedMinutesWatched: Math.round(views * 2.4),
      averageViewDurationSeconds: 120 + (seed % 90),
      averageViewPercentage: 42 + (seed % 35),
      subscribersGained: Math.max(0, Math.round(views * 0.006)),
      subscribersLost: Math.round(views * 0.0005),
    },
  };
}

export function decideAutomationRun(input: {
  enabled: boolean;
  now: Date;
  nextRunAt: Date | null;
  uploadsToday: number;
  dailyUploadLimit: number;
  activeRuns: number;
  maxConcurrentRuns: number;
}):
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "automation_disabled"
        | "automation_not_due"
        | "daily_upload_limit_reached"
        | "automation_run_already_active";
    } {
  if (!input.enabled) {
    return { allowed: false, reason: "automation_disabled" };
  }
  if (input.nextRunAt && input.nextRunAt > input.now) {
    return { allowed: false, reason: "automation_not_due" };
  }
  if (input.uploadsToday >= Math.max(0, input.dailyUploadLimit)) {
    return { allowed: false, reason: "daily_upload_limit_reached" };
  }
  if (input.activeRuns >= Math.max(1, input.maxConcurrentRuns)) {
    return { allowed: false, reason: "automation_run_already_active" };
  }
  return { allowed: true };
}

const ratioToScore = (value: number, baseline: number): number => {
  if (baseline <= 0) return value > 0 ? 50 : 0;
  return round1(clamp((value / baseline) * 50, 0, 100));
};

const formatRatio = (value: number, baseline: number): string =>
  baseline > 0 ? `${(value / baseline).toFixed(2)}倍` : "比較可能な基準値なし";

const normalizeTheme = (theme: string): string =>
  theme.normalize("NFKC").replaceAll(/\s+/g, "").toLowerCase();

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const round1 = (value: number): number => Math.round(value * 10) / 10;

const toFiniteNumber = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toStringOrUnknown = (value: unknown): string =>
  typeof value === "string" && value ? value : "unknown";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
