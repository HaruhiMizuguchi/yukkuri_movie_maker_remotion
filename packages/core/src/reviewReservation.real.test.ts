import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { reserveAutomationRun } from "./closedLoopAutomation";

const isolatedDatabase = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.startsWith(
      "/ymm_review_",
    );
  } catch {
    return false;
  }
})();
if (!isolatedDatabase)
  console.warn(
    "実行予約の実DB試験は専用DB（ymm_review_*）未指定のためスキップします。",
  );

describe.skipIf(!isolatedDatabase)("実PostgreSQLでの自動運用予約", () => {
  it("別接続から同時予約しても実行数・日次投稿数を超過しない", async () => {
    // 本番の運用設定を書き換えないよう、専用DBでのみこの破壊的fixtureを許可する。
    if (!isolatedDatabase) throw new Error("isolated_review_database_required");
    const first = new PrismaClient(),
      second = new PrismaClient();
    try {
      await first.automationConfig.upsert({
        where: { id: "default" },
        create: { enabled: true, dailyUploadLimit: 10, maxConcurrentRuns: 1 },
        update: {
          enabled: true,
          dailyUploadLimit: 10,
          maxConcurrentRuns: 1,
          nextRunAt: null,
        },
      });
      const now = new Date();
      const results = await Promise.all(
        [first, second].map((prisma) =>
          reserveAutomationRun({ prisma, now, trigger: "manual" }),
        ),
      );
      expect(results.filter((result) => result.started)).toHaveLength(1);
      expect(results.filter((result) => !result.started)).toMatchObject([
        { reason: "automation_run_already_active" },
      ]);
      await first.automationRun.deleteMany({ where: { jobId: null } });
      await first.automationConfig.update({
        where: { id: "default" },
        data: { dailyUploadLimit: 1, maxConcurrentRuns: 4 },
      });
      const daily = await Promise.all(
        [first, second].map((prisma) =>
          reserveAutomationRun({ prisma, now, trigger: "manual" }),
        ),
      );
      expect(daily.filter((result) => result.started)).toHaveLength(1);
      expect(daily.filter((result) => !result.started)).toMatchObject([
        { reason: "daily_upload_limit_reached" },
      ]);
    } finally {
      await first.automationRun.deleteMany({ where: { jobId: null } });
      await first.automationConfig.updateMany({ data: { enabled: false } });
      await first.$disconnect();
      await second.$disconnect();
    }
  });
});
