-- YouTube投稿、分析、評価、テーマ判断、自動運用状態を永続化する。
CREATE TABLE "YoutubePublication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "youtubeVideoId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "privacyStatus" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "sourcePath" TEXT NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "YoutubePublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "YoutubeMetricSnapshot" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "windowHours" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "views" BIGINT,
    "likes" BIGINT,
    "comments" BIGINT,
    "shares" BIGINT,
    "estimatedMinutesWatched" DOUBLE PRECISION,
    "averageViewDurationSeconds" DOUBLE PRECISION,
    "averageViewPercentage" DOUBLE PRECISION,
    "subscribersGained" BIGINT,
    "subscribersLost" BIGINT,
    "failureReason" TEXT,
    "rawJson" JSONB,
    CONSTRAINT "YoutubeMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoEvaluation" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "windowHours" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "componentsJson" JSONB NOT NULL,
    "reasonsJson" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemeDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "selectedTheme" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "candidatesJson" JSONB NOT NULL,
    "reasonsJson" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "sourceMetricsUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThemeDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalHours" INTEGER NOT NULL DEFAULT 168,
    "nextRunAt" TIMESTAMP(3),
    "defaultPrivacyStatus" TEXT NOT NULL DEFAULT 'private',
    "publishDelayMinutes" INTEGER NOT NULL DEFAULT 0,
    "dailyUploadLimit" INTEGER NOT NULL DEFAULT 1,
    "maxConcurrentRuns" INTEGER NOT NULL DEFAULT 1,
    "mockWhenApiUnavailable" BOOLEAN NOT NULL DEFAULT true,
    "channelId" TEXT,
    "topicSeed" TEXT NOT NULL DEFAULT 'ゆっくり解説',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "projectId" TEXT,
    "jobId" TEXT,
    "reason" TEXT,
    "detailsJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YoutubePublication_youtubeVideoId_key" ON "YoutubePublication"("youtubeVideoId");
CREATE UNIQUE INDEX "YoutubePublication_idempotencyKey_key" ON "YoutubePublication"("idempotencyKey");
CREATE INDEX "YoutubePublication_projectId_idx" ON "YoutubePublication"("projectId");
CREATE INDEX "YoutubePublication_jobId_idx" ON "YoutubePublication"("jobId");
CREATE INDEX "YoutubePublication_status_publishedAt_idx" ON "YoutubePublication"("status", "publishedAt");
CREATE UNIQUE INDEX "YoutubeMetricSnapshot_publicationId_windowHours_key" ON "YoutubeMetricSnapshot"("publicationId", "windowHours");
CREATE INDEX "YoutubeMetricSnapshot_windowHours_status_idx" ON "YoutubeMetricSnapshot"("windowHours", "status");
CREATE UNIQUE INDEX "VideoEvaluation_publicationId_windowHours_key" ON "VideoEvaluation"("publicationId", "windowHours");
CREATE INDEX "VideoEvaluation_windowHours_score_idx" ON "VideoEvaluation"("windowHours", "score");
CREATE INDEX "ThemeDecision_createdAt_idx" ON "ThemeDecision"("createdAt");
CREATE INDEX "ThemeDecision_projectId_idx" ON "ThemeDecision"("projectId");
CREATE INDEX "AutomationRun_status_startedAt_idx" ON "AutomationRun"("status", "startedAt");
CREATE INDEX "AutomationRun_projectId_idx" ON "AutomationRun"("projectId");
CREATE INDEX "AutomationRun_jobId_idx" ON "AutomationRun"("jobId");

ALTER TABLE "YoutubePublication" ADD CONSTRAINT "YoutubePublication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YoutubePublication" ADD CONSTRAINT "YoutubePublication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YoutubeMetricSnapshot" ADD CONSTRAINT "YoutubeMetricSnapshot_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "YoutubePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoEvaluation" ADD CONSTRAINT "VideoEvaluation_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "YoutubePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeDecision" ADD CONSTRAINT "ThemeDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
