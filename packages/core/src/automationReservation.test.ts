import { describe, expect, it, vi } from "vitest";
import { reserveAutomationRun } from "./closedLoopAutomation";

describe("自動運用の実行枠", () => {
  it("予約済みの投稿枠を日次上限に含める", async () => {
    const create = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      automationConfig: {
        findUnique: async () => ({
          id: "default",
          enabled: true,
          intervalHours: 24,
          dailyUploadLimit: 1,
          maxConcurrentRuns: 4,
        }),
        update: vi.fn(),
      },
      youtubePublication: { count: async () => 0 },
      automationRun: { count: async () => 1, create },
    };
    const result = await reserveAutomationRun({
      prisma: { $transaction: (callback: any) => callback(tx) } as any,
      trigger: "manual",
      now: new Date("2026-09-18"),
    });
    expect(result).toMatchObject({
      started: false,
      reason: "daily_upload_limit_reached",
    });
    expect(create).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalled();
  });
});
