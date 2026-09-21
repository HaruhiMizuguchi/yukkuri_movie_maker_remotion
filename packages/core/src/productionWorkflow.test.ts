import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  createProductionWorkflowImplementations,
  runWorkflow,
  type WorkflowContext,
} from "./index";

const createPrismaMock = (projectId: string, theme: string) => {
  const updates: Array<any> = [];
  const prisma: any = {
    workflowStep: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockImplementation(async (payload) => {
        updates.push(payload);
        return payload;
      }),
    },
    projectFile: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-advanced",
        projectId,
        mode: "full",
        project: { id: projectId, theme },
      }),
    },
    youtubePublication: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (payload) => payload.create),
    },
    automationConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };

  return { prisma, updates };
};

describe("production workflow implementations", () => {
  it("モック投稿を同じ動画の実投稿へ昇格し架空の評価を削除する", async () => {
    const outputRoot = await fs.mkdtemp(
      path.join(process.cwd(), "outputs", "youtube-promote-"),
    );
    const projectId = "mock-promote";
    const finalPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "final",
      "final.mp4",
    );
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, "video-fixture");
    const { prisma } = createPrismaMock(projectId, "昇格");
    prisma.youtubePublication.findUnique.mockResolvedValue({
      id: "mock-publication",
      status: "MOCKED",
      isMock: true,
      youtubeVideoId: "mock-old",
    });
    const db = prisma as any;
    db.youtubeMetricSnapshot = {
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
    };
    db.videoEvaluation = {
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
    };
    db.$transaction = vi.fn(async (callback: any) => callback(db));
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ id: "real-video" })),
    );
    vi.stubEnv("YOUTUBE_ACCESS_TOKEN", "test-token");
    vi.stubEnv("YOUTUBE_REFRESH_TOKEN", "");
    try {
      const steps = createProductionWorkflowImplementations({
        outputRoot,
        fetchFn,
        cacheEnabled: false,
      });
      expect(
        await steps.youtube_upload!({ jobId: "job-advanced", prisma: db }),
      ).toMatchObject({ status: "uploaded", videoId: "real-video" });
      expect(prisma.youtubePublication.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            isMock: false,
            scheduledAt: null,
            publishedAt: null,
            youtubeVideoId: "real-video",
            metricSnapshots: { deleteMany: {} },
            evaluations: { deleteMany: {} },
          }),
        }),
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("選択した画像モデルで背景を生成し、使用量を返す", async () => {
    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "image-model",
      `run-${Date.now()}`,
    );
    const projectId = `project-${Date.now()}`;
    const { prisma } = createPrismaMock(projectId, "未来の都市");
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: imageBytes.toString("base64"),
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 400 },
      }),
    });
    const implementations = createProductionWorkflowImplementations({
      outputRoot,
      googleApiKey: "test-google-key",
      imageModel: "gemini-3.1-flash-lite-image",
      fetchFn: fetchFn as unknown as typeof fetch,
      cacheEnabled: false,
    });

    const result = await implementations.background_generation?.({
      jobId: "job-advanced",
      prisma,
      outputRoot,
    } as WorkflowContext);

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining(
        "/models/gemini-3.1-flash-lite-image:generateContent",
      ),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-goog-api-key": "test-google-key",
        }),
      }),
    );
    expect(result).toMatchObject({
      generationSource: "google-api",
      aiUsage: {
        kind: "image",
        model: "gemini-3.1-flash-lite-image",
        inputTokens: 400,
        imageCount: 1,
      },
    });
    const generated = await fs.readFile(
      path.join(
        outputRoot,
        "projects",
        projectId,
        "output",
        "background_generation",
        "latest",
        "background.png",
      ),
    );
    expect(generated).toEqual(imageBytes);
  });

  it("OpenAI Image APIで16:9背景を生成し、使用量を返す", async () => {
    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "image-model",
      `openai-${Date.now()}`,
    );
    const projectId = `project-${Date.now()}`;
    const { prisma } = createPrismaMock(projectId, "OpenAI画像");
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: imageBytes.toString("base64") }],
        usage: { input_tokens: 300 },
      }),
    });
    const implementations = createProductionWorkflowImplementations({
      outputRoot,
      openaiApiKey: "test-openai-key",
      imageModel: "gpt-image-2",
      fetchFn: fetchFn as unknown as typeof fetch,
      cacheEnabled: false,
    });

    const result = await implementations.background_generation?.({
      jobId: "job-advanced",
      prisma,
      outputRoot,
    } as WorkflowContext);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.openai.com/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-openai-key",
        }),
      }),
    );
    const request = JSON.parse(fetchFn.mock.calls[0]?.[1]?.body as string);
    expect(request).toMatchObject({
      model: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
    });
    expect(result).toMatchObject({
      generationSource: "openai-api",
      aiUsage: {
        provider: "openai",
        model: "gpt-image-2",
        inputTokens: 300,
        imageCount: 1,
      },
    });
  });

  it("AI拡張ステップと運用機能を含む成果物を生成できる", async () => {
    const runId = `run-${Date.now()}`;
    const projectId = `project-${Date.now()}`;
    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "task6",
      runId,
    );
    const { prisma, updates } = createPrismaMock(projectId, "宇宙開発");

    const ctx = {
      jobId: "job-advanced",
      prisma,
      outputRoot,
    } as WorkflowContext;

    const implementations = createProductionWorkflowImplementations({
      outputRoot,
      disableRemotion: true,
      retryCount: 2,
      ttsProvider: "mock",
    });

    await runWorkflow(ctx, implementations, { mode: "full" });
    await runWorkflow(ctx, implementations, { mode: "full" });

    const base = path.join(outputRoot, "projects", projectId, "output");
    await expect(
      fs.stat(path.join(base, "theme_selection", "latest", "theme.json")),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(base, "title_generation", "latest", "title.json")),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(
        path.join(base, "background_generation", "latest", "background.png"),
      ),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(
        path.join(
          base,
          "background_animation",
          "latest",
          "background-animation.json",
        ),
      ),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(
        path.join(
          base,
          "character_synthesis",
          "latest",
          "character-performance.json",
        ),
      ),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(
        path.join(base, "illustration_insertion", "latest", "illustration.png"),
      ),
    ).resolves.toBeTruthy();

    const logPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "logs",
      "workflow.log",
    );
    const logText = await fs.readFile(logPath, "utf-8");
    expect(logText).toContain("cache_hit");

    const cachedOutput = updates.find(
      (payload) => payload.data?.outputJson?.cached === true,
    );
    expect(cachedOutput).toBeTruthy();
    expect(prisma.projectFile.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          jobId: "job-advanced",
          stepName: "theme_selection",
          fileType: "metadata",
          fileCategory: "output",
          relativePath: expect.stringContaining(
            "theme_selection/latest/theme.json",
          ),
        }),
      ]),
      skipDuplicates: true,
    });

    const composition = JSON.parse(
      await fs.readFile(
        path.join(base, "video_composition", "latest", "composition.json"),
        "utf-8",
      ),
    ) as {
      title: string;
      audioPath: string;
      backgroundImagePath: string;
      illustrationImagePath: string;
    };
    expect(composition.title).toContain("宇宙開発");
    expect(composition.audioPath).toContain(
      "audio_enhancement/latest/enhanced.wav",
    );
    expect(composition.backgroundImagePath).toContain(
      "background_generation/latest/background.png",
    );
    expect(composition.illustrationImagePath).toContain(
      "illustration_insertion/latest/illustration.png",
    );
  }, 120000);

  it("YouTubeアクセストークンがある場合は動画アップロードAPIへ送信する", async () => {
    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "youtube-upload",
      `run-${Date.now()}`,
    );
    const projectId = `project-${Date.now()}`;
    const finalPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "final",
      "final.mp4",
    );
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, Buffer.from("video-bytes"));
    const { prisma } = createPrismaMock(projectId, "APIテスト");
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "video-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const previousToken = process.env.YOUTUBE_ACCESS_TOKEN;
    process.env.YOUTUBE_ACCESS_TOKEN = "test-token";
    try {
      const implementations = createProductionWorkflowImplementations({
        outputRoot,
        fetchFn,
      });
      const result = await implementations.youtube_upload?.({
        jobId: "job-advanced",
        prisma,
        outputRoot,
      } as WorkflowContext);
      expect(result).toMatchObject({
        status: "uploaded",
        videoId: "video-123",
      });
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/upload/youtube/v3/videos"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(prisma.youtubePublication.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            youtubeVideoId: "video-123",
            status: "UPLOADED",
            isMock: false,
          }),
        }),
      );
    } finally {
      if (previousToken === undefined) delete process.env.YOUTUBE_ACCESS_TOKEN;
      else process.env.YOUTUBE_ACCESS_TOKEN = previousToken;
    }
  });

  it("YouTube認証がなくモック継続が有効なら投稿台帳をMOCKEDで残す", async () => {
    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "youtube-upload-mock",
      `run-${Date.now()}`,
    );
    const projectId = `project-${Date.now()}`;
    const finalPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "final",
      "final.mp4",
    );
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, Buffer.from("video-bytes"));
    const { prisma } = createPrismaMock(projectId, "API制約テスト");
    prisma.automationConfig.findUnique.mockResolvedValue({
      id: "default",
      mockWhenApiUnavailable: true,
      defaultPrivacyStatus: "private",
      publishDelayMinutes: 0,
    });
    const keys = [
      "YOUTUBE_ACCESS_TOKEN",
      "YOUTUBE_CLIENT_ID",
      "YOUTUBE_CLIENT_SECRET",
      "YOUTUBE_REFRESH_TOKEN",
    ] as const;
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    keys.forEach((key) => delete process.env[key]);
    try {
      const implementations = createProductionWorkflowImplementations({
        outputRoot,
        cacheEnabled: false,
      });
      const result = await implementations.youtube_upload?.({
        jobId: "job-advanced",
        prisma,
        outputRoot,
      } as WorkflowContext);

      expect(result).toMatchObject({
        status: "mocked",
        mocked: true,
        reason: "youtube_credentials_missing",
      });
      expect(prisma.youtubePublication.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: "MOCKED",
            isMock: true,
            youtubeVideoId: expect.stringMatching(/^mock-/),
          }),
        }),
      );
    } finally {
      keys.forEach((key) => {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }
  });

  it("同じプロジェクト成果物を再実行しても重複投稿しない", async () => {
    const outputRoot = path.join(
      process.cwd(),
      "outputs",
      "test_evidence",
      "youtube-upload-duplicate",
      `run-${Date.now()}`,
    );
    const projectId = `project-${Date.now()}`;
    const finalPath = path.join(
      outputRoot,
      "projects",
      projectId,
      "final",
      "final.mp4",
    );
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, Buffer.from("same-video-bytes"));
    const { prisma } = createPrismaMock(projectId, "重複防止テスト");
    prisma.youtubePublication.findUnique.mockResolvedValue({
      id: "publication-existing",
      youtubeVideoId: "video-existing",
      status: "UPLOADED",
    });
    const fetchFn = vi.fn();
    const implementations = createProductionWorkflowImplementations({
      outputRoot,
      fetchFn,
      cacheEnabled: false,
    });

    const result = await implementations.youtube_upload?.({
      jobId: "job-advanced",
      prisma,
      outputRoot,
    } as WorkflowContext);

    expect(result).toMatchObject({
      skipped: true,
      status: "duplicate",
      videoId: "video-existing",
      publicationId: "publication-existing",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
