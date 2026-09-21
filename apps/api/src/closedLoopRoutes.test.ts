import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerClosedLoopRoutes } from "./closedLoopRoutes";

describe("closed loop automation routes", () => {
  it("認証成功時もHTTP応答・証跡・ログへトークンを出さない", async () => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "ymm-secret-boundary-"),
    );
    const logs: string[] = [];
    const app = Fastify({
      logger: { stream: { write: (line: string) => logs.push(line) } },
    });
    await registerClosedLoopRoutes(app, {
      prisma: {
        automationConfig: { findUnique: async () => null },
        youtubePublication: { findMany: async () => [] },
      } as any,
      boss: {} as any,
      workspaceRoot,
      authConfig: { accessToken: "secret-sentinel-review" },
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/automation/collect",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().auth).toEqual({
        available: true,
        source: "access_token",
      });
      const evidence = await fs.readFile(
        path.join(
          workspaceRoot,
          "outputs/test_evidence/task28_closed_loop/latest-collect.json",
        ),
        "utf8",
      );
      expect([response.body, evidence, ...logs].join("\n")).not.toContain(
        "secret-sentinel-review",
      );
    } finally {
      await app.close();
    }
  });
  it("安全範囲を検証して自動運用設定を保存する", async () => {
    const upsert = vi.fn().mockImplementation(({ create }) => create);
    const prisma = {
      automationConfig: { upsert },
    } as any;
    const app = Fastify();
    await registerClosedLoopRoutes(app, {
      prisma,
      boss: {} as any,
      workspaceRoot: process.cwd(),
    });

    const response = await app.inject({
      method: "PUT",
      url: "/api/automation/config",
      payload: {
        enabled: true,
        intervalHours: 48,
        nextRunAt: "2026-07-20T00:00:00.000Z",
        defaultPrivacyStatus: "private",
        publishDelayMinutes: 60,
        dailyUploadLimit: 2,
        maxConcurrentRuns: 1,
        mockWhenApiUnavailable: true,
        channelId: null,
        topicSeed: "AI技術",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "default" },
        create: expect.objectContaining({
          intervalHours: 48,
          nextRunAt: new Date("2026-07-20T00:00:00.000Z"),
        }),
      }),
    );
    await app.close();
  });

  it("認証がない収集でも理由付きモック証跡を保存する", async () => {
    const workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "ymm-closed-loop-api-"),
    );
    const prisma = {
      automationConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          mockWhenApiUnavailable: true,
          channelId: null,
        }),
      },
      youtubePublication: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const app = Fastify();
    await registerClosedLoopRoutes(app, {
      prisma,
      boss: {} as any,
      workspaceRoot,
      authConfig: {},
      now: () => new Date("2026-07-17T00:00:00.000Z"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/automation/collect",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      auth: {
        available: false,
        reason: "youtube_credentials_missing",
      },
      publicationsScanned: 0,
    });
    const evidence = JSON.parse(
      await fs.readFile(
        path.join(
          workspaceRoot,
          "outputs",
          "test_evidence",
          "task28_closed_loop",
          "latest-collect.json",
        ),
        "utf-8",
      ),
    );
    expect(evidence.result.auth.reason).toBe("youtube_credentials_missing");
    await app.close();
  });
});
